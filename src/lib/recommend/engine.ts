import type { Movie } from "@prisma/client";
import { prisma } from "@/lib/db";
import { type AxisVector, euclideanDistance, pickVector } from "@/lib/dna/axes";
import { featureVector, getOrCreateMovieFeatures } from "@/lib/features/generate";
import { ensureMovieByProviderId } from "@/lib/movies/repository";
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

export async function getUserTasteContext(userId: string): Promise<UserTasteContext> {
  const [dnaRow, ratings] = await Promise.all([
    prisma.cinemaDna.findUnique({ where: { userId } }),
    prisma.rating.findMany({ where: { userId }, include: { movie: true } }),
  ]);

  const liked: { title: string; vector: AxisVector }[] = [];
  for (const rating of ratings.filter((r) => r.score >= 3.5)) {
    const feature = await getOrCreateMovieFeatures(rating.movie);
    liked.push({ title: rating.movie.title, vector: featureVector(feature) });
  }

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
}

export type ScoredMovie = {
  movie: Movie;
  vector: AxisVector;
  score: ForYouScore;
  explanation: string;
  external: { provider: string; score: number; scale: number; voteCount: number } | null;
  community: { average: number | null; count: number };
};

export async function scoreMovieForUser(movie: Movie, ctx: UserTasteContext): Promise<ScoredMovie> {
  const feature = await getOrCreateMovieFeatures(movie);
  const vector = featureVector(feature);
  const [externalRow, agg] = await Promise.all([
    prisma.externalRating.findFirst({ where: { movieId: movie.id } }),
    prisma.rating.aggregate({ where: { movieId: movie.id }, _avg: { score: true }, _count: { score: true } }),
  ]);

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
    community: { average: agg._avg.score, count: agg._count.score },
  };
}

/** Candidate retrieval: provider popularity + everything already cached locally. */
async function candidateMovies(limit: number): Promise<Movie[]> {
  const provider = getMovieProvider();
  const summaries = await provider.popular().catch(() => []);
  const movies: Movie[] = [];
  for (const summary of summaries.slice(0, limit)) {
    const movie = await ensureMovieByProviderId(summary.providerId);
    if (movie) movies.push(movie);
  }
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
  const ctx = await getUserTasteContext(userId);
  const pool = await candidateMovies(poolSize);
  const excluded = new Set(excludeMovieIds);

  const scored: ScoredMovie[] = [];
  for (const movie of pool) {
    if (excluded.has(movie.id)) continue;
    if (excludeRated && ctx.ratedMovieIds.has(movie.id)) continue;
    scored.push(await scoreMovieForUser(movie, ctx));
  }

  return scored.sort((a, b) => b.score.match - a.score.match).slice(0, limit);
}

/** Similar titles by 8-axis distance over locally cached movies. */
export async function similarMovies(movie: Movie, limit = 6) {
  const base = featureVector(await getOrCreateMovieFeatures(movie));
  const features = await prisma.movieFeature.findMany({
    where: { movieId: { not: movie.id } },
    include: { movie: true },
    take: 200,
  });
  return features
    .map((f) => ({ movie: f.movie, distance: euclideanDistance(base, featureVector(f)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
