import type { Movie } from "@prisma/client";
import { mapWithConcurrency } from "@/lib/async/pool";
import { prisma } from "@/lib/db";
import {
  FEATURE_VERSION,
  getOrCreateMovieFeaturesMany,
  regenerateMovieFeatures,
} from "@/lib/features/generate";
import { isLlmConfigured } from "@/lib/features/llm";
import { getMovieProvider } from "@/lib/movies/provider";
import { ensureMoviesByProviderIds, refreshStaleMovies } from "@/lib/movies/repository";
import { closeStaleRooms, purgeOldRooms } from "@/lib/rooms/service";

/** How many titles per source are pulled into the local catalogue per run. */
const INGEST_PER_SOURCE = 20;

/** Upper bound on rules-only vectors upgraded per run once an LLM is configured. */
const UPGRADE_BATCH = 20;

export type RefreshReport = {
  ingested: number;
  refreshed: number;
  featuresGenerated: number;
  featuresUpgraded: number;
  roomsClosed: number;
  roomsPurged: number;
};

/**
 * Periodic upkeep so the app stays useful without anyone tending it: new
 * releases enter the catalogue on their own, cached metadata is refreshed,
 * abandoned watch rooms stop lingering, and the database keeps a warm
 * connection (a managed Postgres project that sees no traffic gets paused).
 */
export async function runCatalogueRefresh(): Promise<RefreshReport> {
  const provider = getMovieProvider();
  const [nowPlaying, popular] = await Promise.all([
    provider.nowPlaying().catch(() => []),
    provider.popular().catch(() => []),
  ]);

  const providerIds = [
    ...new Set(
      [
        ...nowPlaying.slice(0, INGEST_PER_SOURCE),
        ...popular.slice(0, INGEST_PER_SOURCE),
      ].map((summary) => summary.providerId),
    ),
  ];

  const ingested = await ensureMoviesByProviderIds(providerIds);
  const features = await getOrCreateMovieFeaturesMany(ingested);
  const refreshed = await refreshStaleMovies(INGEST_PER_SOURCE);
  await mapWithConcurrency(refreshed, 4, (movie) => regenerateMovieFeatures(movie));
  const [roomsClosed, roomsPurged] = await Promise.all([closeStaleRooms(), purgeOldRooms()]);

  return {
    ingested: ingested.length,
    refreshed: refreshed.length,
    featuresGenerated: features.size,
    featuresUpgraded: await upgradeRulesOnlyFeatures(),
    roomsClosed,
    roomsPurged,
  };
}

/**
 * Vectors produced before an LLM key existed stay rules-only forever otherwise,
 * because a stored vector is never revisited on the request path.
 */
async function upgradeRulesOnlyFeatures(): Promise<number> {
  if (!isLlmConfigured()) return 0;

  const stale = await prisma.movieFeature.findMany({
    where: { featureVersion: FEATURE_VERSION, generatorType: "rules_only" },
    include: { movie: true },
    orderBy: { movie: { popularity: "desc" } },
    take: UPGRADE_BATCH,
  });

  const upgraded = await mapWithConcurrency(
    stale.map((feature) => feature.movie),
    4,
    async (movie: Movie) => (await regenerateMovieFeatures(movie)).generatorType,
  );
  return upgraded.filter((generatorType) => generatorType !== "rules_only").length;
}
