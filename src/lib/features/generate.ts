import { cache } from "react";
import { Prisma, type Movie, type MovieFeature } from "@prisma/client";
import { mapWithConcurrency } from "@/lib/async/pool";
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
 * Lazy, cached 8-axis feature generation: only movies a user actually touches
 * are analysed, and the result is stored per feature version.
 */
export const getOrCreateMovieFeatures = cache(async (movie: Movie): Promise<MovieFeature> => {
  const cached = await prisma.movieFeature.findUnique({
    where: { movieId_featureVersion: { movieId: movie.id, featureVersion: FEATURE_VERSION } },
  });
  if (cached) return cached;
  return generateMovieFeatures(movie);
});

/** Feature generation without the cache lookup (callers that already missed it). */
async function generateMovieFeatures(movie: Movie): Promise<MovieFeature> {
  const detail = movieRowToDetail(movie);
  const rules = generateRuleFeatures(detail);
  const llm = isLlmConfigured() ? await classifyWithLlm(detail) : null;
  const vector: AxisVector = llm ? mixVectors(llm, rules.vector, LLM_WEIGHT) : rules.vector;

  const where = { movieId_featureVersion: { movieId: movie.id, featureVersion: FEATURE_VERSION } };
  try {
    return await prisma.movieFeature.upsert({
      where,
      update: {},
      create: {
        movieId: movie.id,
        featureVersion: FEATURE_VERSION,
        ...vector,
        generatorType: llm ? "hybrid_llm_rules" : "rules_only",
        rawFeaturesJson: JSON.stringify({
          rules: rules.vector,
          llm,
          llmWeight: llm ? LLM_WEIGHT : 0,
          matchedGenres: rules.matchedGenres,
          matchedKeywords: rules.matchedKeywords,
        }),
      },
    });
  } catch (error) {
    // Pages score many movies in parallel; on Postgres two of them can insert the
    // same (movieId, featureVersion) at once, and the loser gets P2002.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.movieFeature.findUnique({ where });
      if (raced) return raced;
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

  const cached = await prisma.movieFeature.findMany({
    where: { movieId: { in: [...byId.keys()] }, featureVersion: FEATURE_VERSION },
  });
  for (const feature of cached) features.set(feature.movieId, feature);

  const missing = [...byId.values()].filter((movie) => !features.has(movie.id));
  const generated = await mapWithConcurrency(missing, 4, (movie) => generateMovieFeatures(movie));
  for (const feature of generated) features.set(feature.movieId, feature);

  return features;
}

export const featureVector = (feature: MovieFeature): AxisVector =>
  pickVector(feature as unknown as Record<string, unknown>);
