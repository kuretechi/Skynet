import { cache } from "react";
import type { Movie } from "@prisma/client";
import { TtlCache } from "@/lib/cache/process-cache";
import { prisma } from "@/lib/db";
import { type AxisVector, euclideanDistance, pickVector } from "@/lib/dna/axes";
import { featureVector, getOrCreateMovieFeatures, getOrCreateMovieFeaturesMany } from "@/lib/features/generate";
import { ensureMoviesByProviderIds, movieGenres } from "@/lib/movies/repository";
import { getMovieProvider } from "@/lib/movies/provider";
import { getOrCreateContentSignature, getOrCreateContentSignaturesMany } from "@/lib/signatures/generate";
import { buildFrequencyIndex, signatureSimilarity } from "@/lib/signatures/similarity";
import type { ContentSignature } from "@/lib/signatures/types";
import { RECOMMENDER_CONFIG } from "./config";
import type { ForYouScore } from "./for-you";
import {
  buildPersonalTasteProfile,
  scorePersonalCandidate,
  type PersonalScoreTrace,
  type PersonalTasteProfile,
  type RatedTasteItem,
} from "./personal";

const NEUTRAL_DNA: AxisVector = {
  feel: 0.5, think: 0.5, immerse: 0.5, story: 0.5,
  sense: 0.5, pulse: 0.5, explore: 0.5, depth: 0.5,
};

export type UserTasteContext = {
  dna: AxisVector;
  dnaConfidence: number;
  confidence: number;
  ratingCount: number;
  meanRating: number;
  ratedMovieIds: Set<string>;
  liked: { movieId: string; title: string; vector: AxisVector }[];
  profile: PersonalTasteProfile;
};

export const getUserTasteContext = cache(async (userId: string): Promise<UserTasteContext> => {
  const [dnaRow, ratings] = await Promise.all([
    prisma.cinemaDna.findUnique({ where: { userId } }),
    prisma.rating.findMany({ where: { userId }, include: { movie: true }, orderBy: { updatedAt: "asc" } }),
  ]);
  const movies = ratings.map((rating) => rating.movie);
  const [signatures, features] = await Promise.all([
    getOrCreateContentSignaturesMany(movies),
    getOrCreateMovieFeaturesMany(movies),
  ]);
  const items: RatedTasteItem[] = ratings.flatMap((rating) => {
    const signature = signatures.get(rating.movieId);
    const feature = features.get(rating.movieId);
    if (!signature || !feature) return [];
    return [{
      movieId: rating.movieId,
      title: rating.movie.title,
      score: rating.score,
      masterpiece: rating.masterpiece,
      signature,
      vector: featureVector(feature),
    }];
  });
  const profile = buildPersonalTasteProfile(items);
  const positiveIds = new Set(profile.signals.filter((signal) => signal.preference > 0.08).map((signal) => signal.movieId));
  return {
    dna: dnaRow ? pickVector(dnaRow as unknown as Record<string, unknown>) : NEUTRAL_DNA,
    dnaConfidence: dnaRow?.confidence ?? 0,
    confidence: profile.confidence,
    ratingCount: ratings.length,
    meanRating: profile.meanRating,
    ratedMovieIds: new Set(ratings.map((rating) => rating.movieId)),
    liked: items.filter((item) => positiveIds.has(item.movieId)).map((item) => ({
      movieId: item.movieId,
      title: item.title,
      vector: item.vector,
    })),
    profile,
  };
});

export type ScoredMovie = {
  movie: Movie;
  vector: AxisVector;
  signature: ContentSignature;
  score: ForYouScore;
  trace: PersonalScoreTrace;
  explanation: string;
  external: { provider: string; score: number; scale: number; voteCount: number } | null;
  /** Kept for UI compatibility; community data is not used by the recommender. */
  community: { average: number | null; count: number };
};

export type ScoreOptions = { mood?: { label: string; target: AxisVector } | null };

export async function scoreMovieForUser(movie: Movie, ctx: UserTasteContext, options: ScoreOptions = {}) {
  const [scored] = await scoreMoviesForUser([movie], ctx, options);
  return scored;
}
export async function scoreMoviesForUser(
  movies: readonly Movie[],
  ctx: UserTasteContext,
  options: ScoreOptions = {},
): Promise<ScoredMovie[]> {
  if (movies.length === 0) return [];
  const movieIds = [...new Set(movies.map((movie) => movie.id))];
  const [signatures, features, externalRows] = await Promise.all([
    getOrCreateContentSignaturesMany(movies),
    getOrCreateMovieFeaturesMany(movies),
    prisma.externalRating.findMany({ where: { movieId: { in: movieIds } } }),
  ]);
  const frequency = buildFrequencyIndex([
    ...ctx.profile.signals.map((signal) => signal.signature),
    ...signatures.values(),
  ]);
  const externalByMovie = new Map<string, (typeof externalRows)[number]>();
  for (const row of externalRows) if (!externalByMovie.has(row.movieId)) externalByMovie.set(row.movieId, row);

  return movies.map((movie) => {
    const signature = signatures.get(movie.id)!;
    const feature = features.get(movie.id)!;
    const vector = featureVector(feature);
    const externalRow = externalByMovie.get(movie.id);
    const external = externalRow
      ? { provider: externalRow.provider, score: externalRow.score, scale: externalRow.scoreScale, voteCount: externalRow.voteCount }
      : null;
    const personal = scorePersonalCandidate({
      candidate: signature,
      profile: ctx.profile,
      index: frequency,
      movieVector: vector,
      movieVectorConfidence: feature.confidence,
      dna: ctx.dna,
      dnaConfidence: ctx.dnaConfidence,
      externalScore: external,
      mood: options.mood,
    });
    return {
      movie, vector, signature,
      score: personal.score,
      trace: personal.trace,
      explanation: personal.explanation,
      external,
      community: { average: null, count: 0 },
    };
  });
}

const candidatePool = new TtlCache<number, Movie[]>(60_000);

function candidateMovies(limit: number): Promise<Movie[]> {
  return candidatePool.get(limit, () => loadCandidateMovies(limit));
}

async function loadCandidateMovies(limit: number): Promise<Movie[]> {
  const provider = getMovieProvider();
  const [popular, nowPlaying] = await Promise.all([
    provider.popular().catch(() => []),
    provider.nowPlaying().catch(() => []),
  ]);
  const interleaved: string[] = [];
  for (let index = 0; index < Math.max(popular.length, nowPlaying.length); index += 1) {
    if (popular[index]) interleaved.push(popular[index].providerId);
    if (nowPlaying[index]) interleaved.push(nowPlaying[index].providerId);
  }
  const providerIds = [...new Set(interleaved)];
  const movies = await ensureMoviesByProviderIds(providerIds.slice(0, limit));
  if (movies.length < limit) {
    const cached = await prisma.movie.findMany({ take: limit, orderBy: { popularity: "desc" } });
    for (const movie of cached) if (!movies.some((known) => known.id === movie.id)) movies.push(movie);
  }
  return movies;
}

const seriesKey = (item: ScoredMovie) => item.signature.relations.collection?.key
  ?? item.movie.title.normalize("NFKC").toLocaleLowerCase().split(/[：:／/—–~-]/)[0].replace(/[0-9０-９]+/g, "").trim();

function diversify(items: ScoredMovie[], limit: number) {
  if (items.length <= 1) return items.slice(0, limit);
  const remaining = [...items].sort((a, b) => b.score.match - a.score.match || b.score.predicted - a.score.predicted);
  const output: ScoredMovie[] = [];
  const frequency = buildFrequencyIndex(remaining.map((item) => item.signature));
  const directors = new Map<string, number>();
  const genres = new Map<string, number>();
  const relations = new Map<string, number>();
  const islands = new Map<string, number>();

  while (remaining.length > 0 && output.length < limit) {
    let selectedIndex = 0;
    let selectedPriority = Number.NEGATIVE_INFINITY;
    remaining.forEach((item, index) => {
      const redundancy = output.length
        ? Math.max(...output.map((chosen) => signatureSimilarity(item.signature, chosen.signature, frequency).overall))
        : 0;
      const director = item.movie.director?.toLocaleLowerCase() ?? "";
      const genre = movieGenres(item.movie)[0] ?? "";
      const relation = seriesKey(item);
      const island = item.trace.islandId ?? "";
      const priority = item.score.match / 100
        - redundancy * RECOMMENDER_CONFIG.diversityPenalty
        - (director ? (directors.get(director) ?? 0) * RECOMMENDER_CONFIG.directorRepeatPenalty : 0)
        - (genre ? Math.max(0, (genres.get(genre) ?? 0) - 1) * RECOMMENDER_CONFIG.genreRepeatPenalty : 0)
        - (relation ? (relations.get(relation) ?? 0) * RECOMMENDER_CONFIG.relationRepeatPenalty : 0)
        - (island ? (islands.get(island) ?? 0) * RECOMMENDER_CONFIG.islandRepeatPenalty : 0);
      if (priority > selectedPriority) {
        selectedPriority = priority;
        selectedIndex = index;
      }
    });
    const [chosen] = remaining.splice(selectedIndex, 1);
    output.push(chosen);
    const director = chosen.movie.director?.toLocaleLowerCase();
    const genre = movieGenres(chosen.movie)[0];
    const relation = seriesKey(chosen);
    const island = chosen.trace.islandId;
    if (director) directors.set(director, (directors.get(director) ?? 0) + 1);
    if (genre) genres.set(genre, (genres.get(genre) ?? 0) + 1);
    if (relation) relations.set(relation, (relations.get(relation) ?? 0) + 1);
    if (island) islands.set(island, (islands.get(island) ?? 0) + 1);
  }
  return output;
}

export type RecommendOptions = {
  limit?: number;
  poolSize?: number;
  excludeRated?: boolean;
  excludeMovieIds?: string[];
  mood?: { label: string; target: AxisVector } | null;
};

export async function recommendForUser(
  userId: string,
  { limit = 8, poolSize = 24, excludeRated = true, excludeMovieIds = [], mood = null }: RecommendOptions = {},
): Promise<ScoredMovie[]> {
  const [ctx, pool] = await Promise.all([getUserTasteContext(userId), candidateMovies(poolSize)]);
  const excluded = new Set(excludeMovieIds);
  const candidates = pool.filter((movie) =>
    !excluded.has(movie.id) && !(excludeRated && ctx.ratedMovieIds.has(movie.id)),
  );
  return diversify(await scoreMoviesForUser(candidates, ctx, { mood }), limit);
}

/** Factual Content Signature is primary; the 8-axis distance is a bounded supplement. */
export async function similarMovies(movie: Movie, limit = 6) {
  const candidates = await prisma.movie.findMany({
    where: { id: { not: movie.id } },
    take: 200,
    orderBy: { popularity: "desc" },
  });
  const allMovies = [movie, ...candidates];
  const [signatures, features] = await Promise.all([
    getOrCreateContentSignaturesMany(allMovies),
    getOrCreateMovieFeaturesMany(allMovies),
  ]);
  const baseSignature = signatures.get(movie.id) ?? await getOrCreateContentSignature(movie);
  const baseFeature = features.get(movie.id) ?? await getOrCreateMovieFeatures(movie);
  const baseVector = featureVector(baseFeature);
  const frequency = buildFrequencyIndex(signatures.values());

  return candidates.map((candidate) => {
    const signature = signatures.get(candidate.id)!;
    const feature = features.get(candidate.id)!;
    const content = signatureSimilarity(baseSignature, signature, frequency).overall;
    const axisMatch = 1 - euclideanDistance(baseVector, featureVector(feature)) / Math.sqrt(8);
    const axisWeight = Math.min(
      RECOMMENDER_CONFIG.experienceWeightMaximum,
      RECOMMENDER_CONFIG.experienceWeight * Math.min(baseFeature.confidence, feature.confidence),
    );
    const similarity = content * (1 - axisWeight) + axisMatch * axisWeight;
    return { movie: candidate, distance: 1 - similarity };
  }).sort((a, b) => a.distance - b.distance).slice(0, limit);
}
