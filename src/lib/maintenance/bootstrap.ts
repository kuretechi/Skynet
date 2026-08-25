import type { Movie } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  FEATURE_VERSION,
  getOrCreateMovieFeatures,
  regenerateMovieFeatures,
} from "@/lib/features/generate";
import { isLlmConfigured } from "@/lib/features/llm";
import { getMovieProvider } from "@/lib/movies/provider";
import { ensureMoviesByProviderIds } from "@/lib/movies/repository";

const DEFAULT_TARGET = 1_000;
const DEFAULT_AI_LIMIT = 10;
const MAX_AI_LIMIT = 20;
const MAX_PAGES_PER_RUN = 2;

const boundedInteger = (value: number | undefined, fallback: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(Math.trunc(value as number), max));
};

export type BootstrapOptions = {
  page?: number;
  pages?: number;
  aiLimit?: number;
  target?: number;
  ingest?: boolean;
};

export type BootstrapReport = {
  page: number;
  nextPage: number;
  catalogueTarget: number;
  catalogueSize: number;
  catalogueRemaining: number;
  candidatesFound: number;
  catalogueAdded: number;
  aiConfigured: boolean;
  aiAttempted: number;
  aiSucceeded: number;
  aiFailed: number;
  aiScoredTotal: number;
  rulesOnlyRemaining: number;
  unscoredRemaining: number;
};

/**
 * Adds a bounded slice of popular + highly-rated TMDB titles and upgrades a
 * bounded number to AI-backed vectors. Progress lives in Movie/MovieFeature,
 * making every call idempotent and safe to resume without a cursor table.
 */
export async function runCatalogueBootstrap(options: BootstrapOptions = {}): Promise<BootstrapReport> {
  const provider = getMovieProvider();
  if (provider.name !== "tmdb") throw new Error("TMDB_API_KEY_REQUIRED");

  const page = boundedInteger(options.page, 1, 1, 500);
  const pages = boundedInteger(options.pages, 1, 1, MAX_PAGES_PER_RUN);
  const aiLimit = boundedInteger(options.aiLimit, DEFAULT_AI_LIMIT, 0, MAX_AI_LIMIT);
  const target = boundedInteger(options.target, DEFAULT_TARGET, 1, 2_000);
  const beforeCount = await prisma.movie.count({ where: { provider: provider.name } });
  const shouldIngest = options.ingest !== false && beforeCount < target;

  const summaries = shouldIngest
    ? (await Promise.all(
        Array.from({ length: pages }, (_, index) => page + index).flatMap((sourcePage) => [
          provider.popular(sourcePage).catch(() => []),
          provider.topRated(sourcePage).catch(() => []),
        ]),
      )).flat()
    : [];
  const providerIds = [...new Set(summaries.map((movie) => movie.providerId))];
  await ensureMoviesByProviderIds(providerIds);
  const catalogueSize = await prisma.movie.count({ where: { provider: provider.name } });

  const aiConfigured = isLlmConfigured();
  let aiAttempted = 0;
  let aiSucceeded = 0;
  if (aiConfigured && aiLimit > 0) {
    const missing = await prisma.movie.findMany({
      where: {
        provider: provider.name,
        features: { none: { featureVersion: FEATURE_VERSION } },
      },
      orderBy: [{ popularity: "desc" }, { fetchedAt: "asc" }],
      take: aiLimit,
    });
    const rulesOnly = await prisma.movieFeature.findMany({
      where: {
        featureVersion: FEATURE_VERSION,
        generatorType: "rules_only",
        movie: { provider: provider.name },
      },
      include: { movie: true },
      orderBy: { generatedAt: "asc" },
      take: aiLimit - missing.length,
    });

    const work: { movie: Movie; regenerate: boolean }[] = [
      ...missing.map((movie) => ({ movie, regenerate: false })),
      ...rulesOnly.map((feature) => ({ movie: feature.movie, regenerate: true })),
    ];
    for (const item of work) {
      aiAttempted += 1;
      const feature = item.regenerate
        ? await regenerateMovieFeatures(item.movie)
        : await getOrCreateMovieFeatures(item.movie);
      if (feature.generatorType !== "rules_only") aiSucceeded += 1;
    }
  }

  const [aiScoredTotal, rulesOnlyRemaining, featureTotal] = await Promise.all([
    prisma.movieFeature.count({
      where: {
        featureVersion: FEATURE_VERSION,
        generatorType: { startsWith: "hybrid_" },
        movie: { provider: provider.name },
      },
    }),
    prisma.movieFeature.count({
      where: {
        featureVersion: FEATURE_VERSION,
        generatorType: "rules_only",
        movie: { provider: provider.name },
      },
    }),
    prisma.movieFeature.count({
      where: { featureVersion: FEATURE_VERSION, movie: { provider: provider.name } },
    }),
  ]);

  return {
    page,
    nextPage: page + pages,
    catalogueTarget: target,
    catalogueSize,
    catalogueRemaining: Math.max(0, target - catalogueSize),
    candidatesFound: providerIds.length,
    catalogueAdded: Math.max(0, catalogueSize - beforeCount),
    aiConfigured,
    aiAttempted,
    aiSucceeded,
    aiFailed: aiAttempted - aiSucceeded,
    aiScoredTotal,
    rulesOnlyRemaining,
    unscoredRemaining: Math.max(0, catalogueSize - featureTotal),
  };
}
