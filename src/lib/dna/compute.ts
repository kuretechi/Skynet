import { prisma } from "@/lib/db";
import {
  FEATURE_VERSION,
  featureVector,
  getOrCreateMovieFeaturesMany,
} from "@/lib/features/generate";
import { dnaFromSignals, type DnaComputation, type DnaSignal } from "./derive";

export { dnaFromSignals } from "./derive";
export type { DnaComputation, DnaSignal } from "./derive";

export async function computeCinemaDna(userId: string): Promise<DnaComputation> {
  const ratings = await prisma.rating.findMany({ where: { userId }, include: { movie: true } });
  const features = await getOrCreateMovieFeaturesMany(ratings.map((r) => r.movie));

  const signals: DnaSignal[] = [];
  for (const rating of ratings) {
    const feature = features.get(rating.movieId);
    if (!feature) continue;
    signals.push({
      vector: featureVector(feature),
      score: rating.score,
      masterpiece: rating.masterpiece,
    });
  }

  // Ratings whose features are missing still count towards the rating count.
  return {
    ...dnaFromSignals(signals),
    ratingCount: ratings.length,
    confidence: Number(Math.min(1, ratings.length / 20).toFixed(2)),
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
