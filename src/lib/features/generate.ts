import { Prisma, type Movie, type MovieFeature } from "@prisma/client";
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
export async function getOrCreateMovieFeatures(movie: Movie): Promise<MovieFeature> {
  const cached = await prisma.movieFeature.findUnique({
    where: { movieId_featureVersion: { movieId: movie.id, featureVersion: FEATURE_VERSION } },
  });
  if (cached) return cached;

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

export const featureVector = (feature: MovieFeature): AxisVector =>
  pickVector(feature as unknown as Record<string, unknown>);
