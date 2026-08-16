import { cache } from "react";
import { Prisma, type Movie, type MovieFeature } from "@prisma/client";
import { mapWithConcurrency } from "@/lib/async/pool";
import { LruMap } from "@/lib/cache/process-cache";
import { prisma } from "@/lib/db";
import { type AxisVector, mixVectors, pickVector } from "@/lib/dna/axes";
import { movieRowToDetail } from "@/lib/movies/repository";
import { classifyWithLlm, isLlmConfigured } from "./llm";
import { generateRuleFeatures } from "./rules";

/** Bump when the generation logic changes; cached vectors are keyed by it. */
export const FEATURE_VERSION = "v1";

/** Provisional weights (spec §9.6): LLM 70% / deterministic rules 30%. */
export const LLM_WEIGHT = 0.7;

/**
 * A feature row is stable per (movieId, featureVersion) outside the explicit
 * regeneration path, so once this process has seen one it never has to ask the
 * database again.
 */
const featureCache = new LruMap<string, MovieFeature>(4000);

const remember = (feature: MovieFeature): MovieFeature => {
  featureCache.set(feature.movieId, feature);
  return feature;
};

/**
 * Lazy, cached 8-axis feature generation: only movies a user actually touches
 * are analysed, and the result is stored per feature version.
 */
export const getOrCreateMovieFeatures = cache(async (movie: Movie): Promise<MovieFeature> => {
  const known = featureCache.get(movie.id);
  if (known) return known;

  const cached = await prisma.movieFeature.findUnique({
    where: { movieId_featureVersion: { movieId: movie.id, featureVersion: FEATURE_VERSION } },
  });
  if (cached) return remember(cached);
  return generateMovieFeatures(movie);
});

/** Feature generation without the cache lookup (callers that already missed it). */
async function generateMovieFeatures(movie: Movie, overwrite = false): Promise<MovieFeature> {
  const detail = movieRowToDetail(movie);
  const rules = generateRuleFeatures(detail);
  const llm = isLlmConfigured() ? await classifyWithLlm(detail) : null;
  const vector: AxisVector = llm ? mixVectors(llm, rules.vector, LLM_WEIGHT) : rules.vector;

  const row = {
    ...vector,
    generatorType: llm ? "hybrid_llm_rules" : "rules_only",
    rawFeaturesJson: JSON.stringify({
      rules: rules.vector,
      llm,
      llmWeight: llm ? LLM_WEIGHT : 0,
      matchedGenres: rules.matchedGenres,
      matchedKeywords: rules.matchedKeywords,
    }),
  };

  const where = { movieId_featureVersion: { movieId: movie.id, featureVersion: FEATURE_VERSION } };
  try {
    return remember(await prisma.movieFeature.upsert({
      where,
      update: overwrite ? { ...row, generatedAt: new Date() } : {},
      create: { movieId: movie.id, featureVersion: FEATURE_VERSION, ...row },
    }));
  } catch (error) {
    // Pages score many movies in parallel; on Postgres two of them can insert the
    // same (movieId, featureVersion) at once, and the loser gets P2002.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.movieFeature.findUnique({ where });
      if (raced) return remember(raced);
    }
    throw error;
  }
}

/**
 * Batch equivalent of {@link getOrCreateMovieFeatures}: one query for every
 * cached vector, then bounded-parallel generation for the misses only.
 */
export async function getOrCreateMovieFeaturesMany(
  movies: readonly Movie[],
): Promise<Map<string, MovieFeature>> {
  const byId = new Map(movies.map((movie) => [movie.id, movie]));
  const features = new Map<string, MovieFeature>();
  if (byId.size === 0) return features;

  const unknownIds: string[] = [];
  for (const id of byId.keys()) {
    const known = featureCache.get(id);
    if (known) features.set(id, known);
    else unknownIds.push(id);
  }

  if (unknownIds.length > 0) {
    const cached = await prisma.movieFeature.findMany({
      where: { movieId: { in: unknownIds }, featureVersion: FEATURE_VERSION },
    });
    for (const feature of cached) features.set(feature.movieId, remember(feature));
  }

  const missing = [...byId.values()].filter((movie) => !features.has(movie.id));
  const generated = await mapWithConcurrency(missing, 4, (movie) => generateMovieFeatures(movie));
  for (const feature of generated) features.set(feature.movieId, feature);

  return features;
}

/**
 * Rewrites a stored vector in place. Used when the inputs changed after the
 * first pass: refreshed provider metadata, or an LLM key added later so titles
 * analysed as `rules_only` can be upgraded without a feature version bump.
 */
export async function regenerateMovieFeatures(movie: Movie): Promise<MovieFeature> {
  featureCache.delete(movie.id);
  return generateMovieFeatures(movie, true);
}

export const featureVector = (feature: MovieFeature): AxisVector =>
  pickVector(feature as unknown as Record<string, unknown>);
