import { prisma } from "@/lib/db";
import { FEATURE_VERSION, featureVector, getOrCreateMovieFeatures } from "@/lib/features/generate";
import { AXES, type AxisVector, clampVector } from "./axes";
import { bestCineType } from "./cinetype";

/** Pull towards a neutral 0.5 prior so a handful of ratings cannot extremise the DNA. */
const PRIOR_STRENGTH = 2.5;

/** Ratings above this count as "liked", below as "disliked". */
const NEUTRAL_RATING = 2.75;

export type DnaComputation = {
  vector: AxisVector;
  ratingCount: number;
  confidence: number;
  cineTypeId: string | null;
  cineTypeSimilarity: number;
};

/**
 * Cinema DNA = watch history + personal ratings + movie feature vectors.
 * Liked movies pull each axis towards the movie's value; disliked movies pull
 * it towards the opposite end, weighted by how strong the opinion was.
 */
export async function computeCinemaDna(userId: string): Promise<DnaComputation> {
  const ratings = await prisma.rating.findMany({ where: { userId }, include: { movie: true } });

  const numerator = AXES.reduce((acc, axis) => ({ ...acc, [axis]: 0 }), {} as AxisVector);
  let weightSum = 0;

  for (const rating of ratings) {
    const feature = await getOrCreateMovieFeatures(rating.movie);
    const vec = featureVector(feature);
    const signed = rating.score - NEUTRAL_RATING;
    const weight = Math.abs(signed);
    if (weight === 0) continue;
    for (const axis of AXES) {
      numerator[axis] += weight * (signed > 0 ? vec[axis] : 1 - vec[axis]);
    }
    weightSum += weight;
  }

  const vector = clampVector(
    AXES.reduce(
      (acc, axis) => ({
        ...acc,
        [axis]: (numerator[axis] + PRIOR_STRENGTH * 0.5) / (weightSum + PRIOR_STRENGTH),
      }),
      {} as AxisVector,
    ),
  );

  const ratingCount = ratings.length;
  const confidence = Number(Math.min(1, ratingCount / 20).toFixed(2));
  const match = bestCineType(vector);

  return {
    vector,
    ratingCount,
    confidence,
    cineTypeId: ratingCount > 0 ? match.type.id : null,
    cineTypeSimilarity: match.similarity,
  };
}

export async function refreshCinemaDna(userId: string) {
  const dna = await computeCinemaDna(userId);
  return prisma.cinemaDna.upsert({
    where: { userId },
    update: {
      featureVersion: FEATURE_VERSION,
      ...dna.vector,
      cineTypeId: dna.cineTypeId,
      confidence: dna.confidence,
      ratingCount: dna.ratingCount,
    },
    create: {
      userId,
      featureVersion: FEATURE_VERSION,
      ...dna.vector,
      cineTypeId: dna.cineTypeId,
      confidence: dna.confidence,
      ratingCount: dna.ratingCount,
    },
  });
}
