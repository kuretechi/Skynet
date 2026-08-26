import { AXES, type AxisVector, clampVector } from "./axes";
import { bestCineType } from "./cinetype";
import { preferenceSignal, shrunkPersonalMean } from "@/lib/recommend/personal";

/** Pull towards a neutral 0.5 prior so a handful of ratings cannot extremise the DNA. */
const PRIOR_STRENGTH = 2.5;

export type DnaComputation = {
  vector: AxisVector;
  ratingCount: number;
  confidence: number;
  cineTypeId: string | null;
  cineTypeSimilarity: number;
};

/** One rated movie: the movie's feature vector and the score given to it. */
export type DnaSignal = { vector: AxisVector; score: number; masterpiece?: boolean; featureConfidence?: number };

/**
 * Cinema DNA = watch history + personal ratings + movie feature vectors.
 * Liked movies pull each axis towards the movie's value; disliked movies pull
 * it towards the opposite end, weighted by how strong the opinion was.
 *
 * Pure so the same maths can run on the server for a signed-in profile and in
 * the browser for the sign-in free demo.
 */
export function dnaFromSignals(signals: DnaSignal[]): DnaComputation {
  const numerator = AXES.reduce((acc, axis) => ({ ...acc, [axis]: 0 }), {} as AxisVector);
  let weightSum = 0;

  const personalMean = shrunkPersonalMean(signals.map((signal) => signal.score));
  let confidenceTotal = 0;
  for (const { vector: vec, score, masterpiece, featureConfidence = 1 } of signals) {
    const signed = preferenceSignal(score, personalMean, masterpiece);
    const weight = Math.abs(signed) * featureConfidence;
    if (weight === 0) continue;
    for (const axis of AXES) {
      numerator[axis] += weight * (signed > 0 ? vec[axis] : 1 - vec[axis]);
    }
    weightSum += weight;
    confidenceTotal += featureConfidence;
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

  const ratingCount = signals.length;
  const evidenceConfidence = ratingCount / (ratingCount + 8);
  const featureConfidence = ratingCount ? confidenceTotal / ratingCount : 0;
  const confidence = Number(Math.min(1, evidenceConfidence * featureConfidence).toFixed(2));
  const match = bestCineType(vector);

  return {
    vector,
    ratingCount,
    confidence,
    cineTypeId: ratingCount > 0 ? match.type.id : null,
    cineTypeSimilarity: match.similarity,
  };
}

