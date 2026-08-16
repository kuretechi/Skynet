import { cache } from "react";
import type { Movie } from "@prisma/client";
import { mapWithConcurrency } from "@/lib/async/pool";
import { prisma } from "@/lib/db";
import { getMovieProvider } from "./provider";
import type { ProviderMovieDetail, ProviderMovieSummary } from "./types";

const parseArray = (json: string): string[] => {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
};

export const movieRowToDetail = (movie: Movie): ProviderMovieDetail => ({
  providerId: movie.providerId,
  title: movie.title,
  originalTitle: movie.originalTitle ?? undefined,
  releaseDate: movie.releaseDate ?? undefined,
  posterPath: movie.posterPath ?? undefined,
  backdropPath: movie.backdropPath ?? undefined,
  overview: movie.overview,
  popularity: movie.popularity,
  voteAverage: 0,
  voteCount: 0,
  genres: parseArray(movie.genresJson),
  runtime: movie.runtime ?? undefined,
  country: movie.country ?? undefined,
  language: movie.language ?? undefined,
  director: movie.director ?? undefined,
  cast: parseArray(movie.castJson),
  keywords: parseArray(movie.keywordsJson),
});

export const movieGenres = (movie: Movie) => parseArray(movie.genresJson);
export const movieKeywords = (movie: Movie) => parseArray(movie.keywordsJson);
export const movieCast = (movie: Movie) => parseArray(movie.castJson);

export const posterUrl = (movie: Pick<Movie, "posterPath">) =>
  getMovieProvider().imageUrl(movie.posterPath, "poster");

export const backdropUrl = (movie: Pick<Movie, "backdropPath">) =>
  getMovieProvider().imageUrl(movie.backdropPath, "backdrop");

const upsertFromDetail = async (detail: ProviderMovieDetail): Promise<Movie> => {
  const provider = getMovieProvider();
  const data = {
    title: detail.title,
    originalTitle: detail.originalTitle,
    overview: detail.overview,
    releaseDate: detail.releaseDate,
    runtime: detail.runtime,
    country: detail.country,
    language: detail.language,
    director: detail.director,
    posterPath: detail.posterPath,
    backdropPath: detail.backdropPath,
    popularity: detail.popularity,
    genresJson: JSON.stringify(detail.genres),
    keywordsJson: JSON.stringify(detail.keywords),
    castJson: JSON.stringify(detail.cast),
    fetchedAt: new Date(),
  };

  const movie = await prisma.movie.upsert({
    where: { provider_providerId: { provider: provider.name, providerId: detail.providerId } },
    update: data,
    create: { provider: provider.name, providerId: detail.providerId, ...data },
  });

  if (detail.voteCount > 0) {
    await prisma.externalRating.upsert({
      where: { movieId_provider: { movieId: movie.id, provider: provider.name } },
      update: { score: detail.voteAverage, scoreScale: 10, voteCount: detail.voteCount, fetchedAt: new Date() },
      create: {
        movieId: movie.id,
        provider: provider.name,
        score: detail.voteAverage,
        scoreScale: 10,
        voteCount: detail.voteCount,
      },
    });
  }

  return movie;
};

/**
 * Lazy movie database: a movie row is created the first time a user opens or
 * interacts with the title, never by bulk syncing the provider catalogue.
 */
export const ensureMovieByProviderId = cache(async (providerId: string): Promise<Movie | null> => {
  const provider = getMovieProvider();
  const existing = await prisma.movie.findUnique({
    where: { provider_providerId: { provider: provider.name, providerId } },
  });
  const stale = existing && Date.now() - existing.fetchedAt.getTime() > CACHE_TTL_MS;
  if (existing && !stale) return existing;

  const detail = await provider.detail(providerId);
  if (!detail) return existing;
  return upsertFromDetail(detail);
});

export const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

/**
 * Batch equivalent of {@link ensureMovieByProviderId}: one query for the whole
 * cached set, provider round trips only for the misses, in input order.
 */
export async function ensureMoviesByProviderIds(providerIds: readonly string[]): Promise<Movie[]> {
  if (providerIds.length === 0) return [];
  const provider = getMovieProvider();
  const existing = await prisma.movie.findMany({
    where: { provider: provider.name, providerId: { in: [...new Set(providerIds)] } },
  });
  const cachedByProviderId = new Map(existing.map((movie) => [movie.providerId, movie]));

  const movies = await mapWithConcurrency(providerIds, 6, async (providerId) => {
    const cached = cachedByProviderId.get(providerId);
    if (cached && Date.now() - cached.fetchedAt.getTime() <= CACHE_TTL_MS) return cached;
    const detail = await provider.detail(providerId);
    if (!detail) return cached ?? null;
    return upsertFromDetail(detail);
  });

  return movies.filter((movie): movie is Movie => movie !== null);
}

/**
 * Refreshes the oldest cached rows regardless of whether anyone opened them.
 * Ratings, reviews and shelves keep pointing at the same row, so only the
 * provider-owned metadata changes.
 */
export async function refreshStaleMovies(limit: number): Promise<Movie[]> {
  const provider = getMovieProvider();
  const stale = await prisma.movie.findMany({
    where: { provider: provider.name, fetchedAt: { lt: new Date(Date.now() - CACHE_TTL_MS) } },
    orderBy: { fetchedAt: "asc" },
    take: limit,
  });

  const refreshed = await mapWithConcurrency(stale, 4, async (movie) => {
    const detail = await provider.detail(movie.providerId);
    return detail ? upsertFromDetail(detail) : null;
  });
  return refreshed.filter((movie): movie is Movie => movie !== null);
}

export async function searchMovies(query: string): Promise<ProviderMovieSummary[]> {
  return getMovieProvider().search(query);
}

export async function popularMovies(): Promise<ProviderMovieSummary[]> {
  return getMovieProvider().popular();
}

export async function communityScore(movieId: string) {
  const agg = await prisma.rating.aggregate({
    where: { movieId },
    _avg: { score: true },
    _count: { score: true },
  });
  return { average: agg._avg.score ?? null, count: agg._count.score };
}
