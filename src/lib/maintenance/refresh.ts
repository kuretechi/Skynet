import { mapWithConcurrency } from "@/lib/async/pool";
import { prisma } from "@/lib/db";
import { refreshCinemaDna } from "@/lib/dna/compute";
import {
  FEATURE_VERSION,
  getOrCreateMovieFeaturesMany,
  regenerateMovieFeatures,
} from "@/lib/features/generate";
import { getMovieProvider } from "@/lib/movies/provider";
import { ensureMoviesByProviderIds, refreshStaleMovies } from "@/lib/movies/repository";
import { closeStaleRooms, purgeOldRooms } from "@/lib/rooms/service";
import { getOrCreateContentSignaturesMany, regenerateContentSignature } from "@/lib/signatures/generate";

const INGEST_PER_SOURCE = 20;

export type RefreshReport = {
  ingested: number;
  refreshed: number;
  signaturesGenerated: number;
  experienceVectorsGenerated: number;
  dnaRefreshed: number;
  oldDerivedRowsPurged: number;
  roomsClosed: number;
  roomsPurged: number;
};

/** Metadata upkeep plus deterministic derived data; no external AI is called. */
export async function runCatalogueRefresh(): Promise<RefreshReport> {
  const provider = getMovieProvider();
  const [nowPlaying, popular] = await Promise.all([
    provider.nowPlaying().catch(() => []),
    provider.popular().catch(() => []),
  ]);
  const providerIds = [...new Set([
    ...nowPlaying.slice(0, INGEST_PER_SOURCE),
    ...popular.slice(0, INGEST_PER_SOURCE),
  ].map((summary) => summary.providerId))];
  const ingested = await ensureMoviesByProviderIds(providerIds);
  const [signatures, vectors, refreshed] = await Promise.all([
    getOrCreateContentSignaturesMany(ingested),
    getOrCreateMovieFeaturesMany(ingested),
    refreshStaleMovies(INGEST_PER_SOURCE),
  ]);
  await mapWithConcurrency(refreshed, 4, async (movie) => {
    await Promise.all([regenerateContentSignature(movie), regenerateMovieFeatures(movie)]);
  });
  const users = await prisma.user.findMany({
    where: { ratings: { some: {} } },
    select: { id: true, dna: { select: { featureVersion: true } } },
  });
  const staleUsers = users.filter((user) => user.dna?.featureVersion !== FEATURE_VERSION);
  await mapWithConcurrency(staleUsers, 2, (user) => refreshCinemaDna(user.id));

  // A previous deployment can briefly recreate legacy rows while a migration is
  // rolling out. Purge only after every active user's v2 DNA is safely rebuilt.
  const [oldFeatures, oldDna, roomsClosed, roomsPurged] = await Promise.all([
    prisma.movieFeature.deleteMany({ where: { featureVersion: { not: FEATURE_VERSION } } }),
    prisma.cinemaDna.deleteMany({ where: { featureVersion: { not: FEATURE_VERSION } } }),
    closeStaleRooms(),
    purgeOldRooms(),
  ]);
  return {
    ingested: ingested.length,
    refreshed: refreshed.length,
    signaturesGenerated: signatures.size,
    experienceVectorsGenerated: vectors.size,
    dnaRefreshed: staleUsers.length,
    oldDerivedRowsPurged: oldFeatures.count + oldDna.count,
    roomsClosed,
    roomsPurged,
  };
}
