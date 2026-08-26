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
const MAX_INGEST_PER_RUN = 20;
const SEGMENTS_PER_PAGE = 3;
const BACKFILL_GENRE_IDS = ["28", "12", "16", "35", "80", "18", "10751", "14", "27", "9648", "10749", "878", "53", "99"] as const;
const BACKFILL_COUNTRIES = ["JP", "US", "GB", "KR", "FR", "CN", "HK", "DE", "IT", "ES", "IN", "CA", "AU"] as const;
const BACKFILL_DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950] as const;

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

const backfillSegment = (index: number) => {
  const genreIndex = index % BACKFILL_GENRE_IDS.length;
  const countryIndex = Math.floor(index / BACKFILL_GENRE_IDS.length) % BACKFILL_COUNTRIES.length;
  const decadeIndex = Math.floor(index / (BACKFILL_GENRE_IDS.length * BACKFILL_COUNTRIES.length)) % BACKFILL_DECADES.length;
  const yearFrom = BACKFILL_DECADES[decadeIndex];
  return {
    genreIds: [BACKFILL_GENRE_IDS[genreIndex]],
    country: BACKFILL_COUNTRIES[countryIndex],
    yearFrom,
    yearTo: yearFrom + 9,
    page: 1 + Math.floor(index / (BACKFILL_GENRE_IDS.length * BACKFILL_COUNTRIES.length * BACKFILL_DECADES.length)),
  };
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
        Array.from({ length: pages }, (_, index) => page + index).flatMap((sourcePage) => {
          const segmentOffset = (sourcePage - 1) * SEGMENTS_PER_PAGE;
          return [
            provider.popular(sourcePage).catch(() => []),
            provider.topRated(sourcePage).catch(() => []),
            ...Array.from({ length: SEGMENTS_PER_PAGE }, (_, segmentIndex) =>
              provider.discover(backfillSegment(segmentOffset + segmentIndex)).catch(() => []),
            ),
          ];
        }),
      )).flat()
    : [];
  if (shouldIngest && summaries.length === 0) throw new Error("MOVIE_PROVIDER_UNAVAILABLE");
  const candidateIds = [...new Set(summaries.map((movie) => movie.providerId))];
  const existing = candidateIds.length
    ? await prisma.movie.findMany({
        where: { provider: provider.name, mediaType: "movie", providerId: { in: candidateIds } },
        select: { providerId: true },
      })
    : [];
  const existingIds = new Set(existing.map((movie) => movie.providerId));
  const providerIds = candidateIds
    .filter((providerId) => !existingIds.has(providerId))
    .slice(0, Math.min(MAX_INGEST_PER_RUN, Math.max(0, target - beforeCount)));
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
