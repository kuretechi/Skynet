import { cache } from "react";
import type { Movie, MovieFeature } from "@prisma/client";
import { TtlCache } from "@/lib/cache/process-cache";
import { prisma } from "@/lib/db";
import { type AxisVector, euclideanDistance, pickVector } from "@/lib/dna/axes";
import {
  featureVector,
  getOrCreateMovieFeatures,
  getOrCreateMovieFeaturesMany,
} from "@/lib/features/generate";
import { ensureMoviesByProviderIds } from "@/lib/movies/repository";
import { getMovieProvider } from "@/lib/movies/provider";
import { buildExplanation, computeForYouScore, type ForYouScore } from "./for-you";

export type UserTasteContext = {
  dna: AxisVector;
  confidence: number;
  ratingCount: number;
  meanRating: number;
  ratedMovieIds: Set<string>;
  liked: { title: string; vector: AxisVector }[];
};

export const getUserTasteContext = cache(async (userId: string): Promise<UserTasteContext> => {
  const [dnaRow, ratings] = await Promise.all([
    prisma.cinemaDna.findUnique({ where: { userId } }),
    prisma.rating.findMany({ where: { userId }, include: { movie: true } }),
  ]);

  const likedRatings = ratings.filter((r) => r.score >= 3.5);
  const likedFeatures = await getOrCreateMovieFeaturesMany(likedRatings.map((r) => r.movie));
  const liked = likedRatings.flatMap((rating) => {
    const feature = likedFeatures.get(rating.movieId);
    return feature ? [{ title: rating.movie.title, vector: featureVector(feature) }] : [];
  });

  const meanRating = ratings.length
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : 3.4;

  return {
    dna: dnaRow
      ? pickVector(dnaRow as unknown as Record<string, unknown>)
      : ({ feel: 0.5, think: 0.5, immerse: 0.5, story: 0.5, sense: 0.5, pulse: 0.5, explore: 0.5, depth: 0.5 } as AxisVector),
    confidence: dnaRow?.confidence ?? 0,
    ratingCount: ratings.length,
    meanRating,
    ratedMovieIds: new Set(ratings.map((r) => r.movieId)),
    liked,
  };
});

export type ScoredMovie = {
  movie: Movie;
  vector: AxisVector;
  score: ForYouScore;
  explanation: string;
  external: { provider: string; score: number; scale: number; voteCount: number } | null;
  community: { average: number | null; count: number };
};

export async function scoreMovieForUser(movie: Movie, ctx: UserTasteContext): Promise<ScoredMovie> {
  const [scored] = await scoreMoviesForUser([movie], ctx);
  return scored;
}

/**
 * Scores a whole set at once: three queries for the batch (feature vectors,
 * external ratings, community averages) instead of three per movie.
 */
export async function scoreMoviesForUser(
  movies: readonly Movie[],
  ctx: UserTasteContext,
): Promise<ScoredMovie[]> {
  if (movies.length === 0) return [];
  const movieIds = [...new Set(movies.map((m) => m.id))];

  const [features, externalRows, aggregates] = await Promise.all([
    getOrCreateMovieFeaturesMany(movies),
    prisma.externalRating.findMany({ where: { movieId: { in: movieIds } } }),
    prisma.rating.groupBy({
      by: ["movieId"],
      where: { movieId: { in: movieIds } },
      _avg: { score: true },
      _count: { score: true },
    }),
  ]);

  const externalByMovie = new Map<string, (typeof externalRows)[number]>();
  for (const row of externalRows) if (!externalByMovie.has(row.movieId)) externalByMovie.set(row.movieId, row);
  const aggByMovie = new Map(aggregates.map((row) => [row.movieId, row]));

  return Promise.all(
    movies.map(async (movie) => {
      const feature = features.get(movie.id) ?? (await getOrCreateMovieFeatures(movie));
      const vector = featureVector(feature);
      const externalRow = externalByMovie.get(movie.id);
      const agg = aggByMovie.get(movie.id);

      const external = externalRow
        ? {
            provider: externalRow.provider,
            score: externalRow.score,
            scale: externalRow.scoreScale,
            voteCount: externalRow.voteCount,
          }
        : null;

      return {
        movie,
        vector,
        score: computeForYouScore({
          dna: ctx.dna,
          dnaConfidence: ctx.confidence,
          movie: vector,
          userMeanRating: ctx.meanRating,
          externalScore: external,
        }),
        explanation: buildExplanation(ctx.dna, vector, ctx.liked),
        external,
        community: { average: agg?._avg.score ?? null, count: agg?._count.score ?? 0 },
      };
    }),
  );
}

/**
 * The candidate pool is the same for everyone, so an instance builds it at most
 * once a minute instead of once per navigation.
 */
const candidatePool = new TtlCache<number, Movie[]>(60_000);
const similarityPool = new TtlCache<string, (MovieFeature & { movie: Movie })[]>(60_000);

/** Candidate retrieval: provider popularity + everything already cached locally. */
function candidateMovies(limit: number): Promise<Movie[]> {
  return candidatePool.get(limit, () => loadCandidateMovies(limit));
}

async function loadCandidateMovies(limit: number): Promise<Movie[]> {
  const provider = getMovieProvider();
  // Popularity alone lags behind release schedules, so recent titles are mixed
  // in: without this a film only becomes recommendable once it trends.
  const [popular, nowPlaying] = await Promise.all([
    provider.popular().catch(() => []),
    provider.nowPlaying().catch(() => []),
  ]);
  const interleaved: string[] = [];
  for (let i = 0; i < Math.max(popular.length, nowPlaying.length); i += 1) {
    if (popular[i]) interleaved.push(popular[i].providerId);
    if (nowPlaying[i]) interleaved.push(nowPlaying[i].providerId);
  }
  const providerIds = [...new Set(interleaved)];
  const movies = await ensureMoviesByProviderIds(providerIds.slice(0, limit));
  if (movies.length < limit) {
    const cached = await prisma.movie.findMany({ take: limit, orderBy: { popularity: "desc" } });
    for (const movie of cached) if (!movies.some((m) => m.id === movie.id)) movies.push(movie);
  }
  return movies;
}

export type RecommendOptions = {
  limit?: number;
  poolSize?: number;
  excludeRated?: boolean;
  excludeMovieIds?: string[];
};

export async function recommendForUser(
  userId: string,
  { limit = 8, poolSize = 24, excludeRated = true, excludeMovieIds = [] }: RecommendOptions = {},
): Promise<ScoredMovie[]> {
  const [ctx, pool] = await Promise.all([getUserTasteContext(userId), candidateMovies(poolSize)]);
  const excluded = new Set(excludeMovieIds);

  const candidates = pool.filter(
    (movie) =>
      !excluded.has(movie.id) && !(excludeRated && ctx.ratedMovieIds.has(movie.id)),
  );
  const scored = await scoreMoviesForUser(candidates, ctx);

  return scored.sort((a, b) => b.score.match - a.score.match).slice(0, limit);
}

/** Similar titles by 8-axis distance over locally cached movies. */
export async function similarMovies(movie: Movie, limit = 6) {
  const [baseFeature, features] = await Promise.all([
    getOrCreateMovieFeatures(movie),
    similarityPool.get("all", () =>
      prisma.movieFeature.findMany({
        include: { movie: true },
        take: 201,
        orderBy: { movie: { popularity: "desc" } },
      }),
    ),
  ]);
  const base = featureVector(baseFeature);
  return features
    .filter((f) => f.movieId !== movie.id)
    .slice(0, 200)
    .map((f) => ({ movie: f.movie, distance: euclideanDistance(base, featureVector(f)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
