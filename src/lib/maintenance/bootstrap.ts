import { prisma } from "@/lib/db";
import { FEATURE_VERSION, getOrCreateMovieFeaturesMany } from "@/lib/features/generate";
import { getMovieProvider } from "@/lib/movies/provider";
import { ensureMoviesByProviderIds } from "@/lib/movies/repository";
import { CONTENT_SIGNATURE_VERSION } from "@/lib/recommend/config";
import { getOrCreateContentSignaturesMany } from "@/lib/signatures/generate";

const DEFAULT_TARGET = 1_000;
const DEFAULT_DERIVED_LIMIT = 50;
const MAX_DERIVED_LIMIT = 100;
const MAX_PAGES_PER_RUN = 2;

const boundedInteger = (value: number | undefined, fallback: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(Math.trunc(value as number), max));
};

export type BootstrapOptions = {
  page?: number;
  pages?: number;
  derivedLimit?: number;
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
  signaturesGenerated: number;
  experienceVectorsGenerated: number;
  signaturesRemaining: number;
  experienceVectorsRemaining: number;
};

/** Adds catalogue metadata and deterministic derived data in bounded, resumable batches. */
export async function runCatalogueBootstrap(options: BootstrapOptions = {}): Promise<BootstrapReport> {
  const provider = getMovieProvider();
  if (provider.name !== "tmdb") throw new Error("TMDB_API_KEY_REQUIRED");
  const page = boundedInteger(options.page, 1, 1, 500);
  const pages = boundedInteger(options.pages, 1, 1, MAX_PAGES_PER_RUN);
  const derivedLimit = boundedInteger(options.derivedLimit, DEFAULT_DERIVED_LIMIT, 0, MAX_DERIVED_LIMIT);
  const target = boundedInteger(options.target, DEFAULT_TARGET, 1, 2_000);
  const beforeCount = await prisma.movie.count({ where: { provider: provider.name, mediaType: "movie" } });
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
  const catalogueSize = await prisma.movie.count({ where: { provider: provider.name, mediaType: "movie" } });
  const [missingSignatures, missingVectors] = await Promise.all([
    prisma.movie.findMany({
      where: {
        provider: provider.name,
        mediaType: "movie",
        contentSignatures: { none: { signatureVersion: CONTENT_SIGNATURE_VERSION } },
      },
      orderBy: [{ popularity: "desc" }, { fetchedAt: "asc" }],
      take: derivedLimit,
    }),
    prisma.movie.findMany({
      where: {
        provider: provider.name,
        mediaType: "movie",
        features: { none: { featureVersion: FEATURE_VERSION } },
      },
      orderBy: [{ popularity: "desc" }, { fetchedAt: "asc" }],
      take: derivedLimit,
    }),
  ]);
  const [signatures, vectors] = await Promise.all([
    getOrCreateContentSignaturesMany(missingSignatures),
    getOrCreateMovieFeaturesMany(missingVectors),
  ]);
  const [signatureTotal, vectorTotal] = await Promise.all([
    prisma.movieContentSignature.count({
      where: { signatureVersion: CONTENT_SIGNATURE_VERSION, movie: { provider: provider.name, mediaType: "movie" } },
    }),
    prisma.movieFeature.count({
      where: { featureVersion: FEATURE_VERSION, movie: { provider: provider.name, mediaType: "movie" } },
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
    signaturesGenerated: signatures.size,
    experienceVectorsGenerated: vectors.size,
    signaturesRemaining: Math.max(0, catalogueSize - signatureTotal),
    experienceVectorsRemaining: Math.max(0, catalogueSize - vectorTotal),
  };
}
