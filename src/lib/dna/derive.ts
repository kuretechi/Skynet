import { AXES, type AxisVector, clampVector } from "./axes";
import { bestCineType } from "./cinetype";

/** Pull towards a neutral 0.5 prior so a handful of ratings cannot extremise the DNA. */
const PRIOR_STRENGTH = 2.5;

/** Ratings above this count as "liked", below as "disliked". */
const NEUTRAL_RATING = 2.75;

/**
 * A Masterpiece is the ceiling of the scale: it carries the weight a perfect
 * star rating used to carry, and every star rating now weighs a share of that,
 * so nothing a user can express with stars outranks marking a masterpiece.
 */
export const MASTERPIECE_WEIGHT = 5 - NEUTRAL_RATING;
const STAR_SHARE = 0.8;

export type DnaComputation = {
  vector: AxisVector;
  ratingCount: number;
  confidence: number;
  cineTypeId: string | null;
  cineTypeSimilarity: number;
};

/** One rated movie: the movie's feature vector and the score given to it. */
export type DnaSignal = { vector: AxisVector; score: number; masterpiece?: boolean };

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

  for (const { vector: vec, score, masterpiece } of signals) {
    const signed = masterpiece
      ? MASTERPIECE_WEIGHT
      : (score - NEUTRAL_RATING) * STAR_SHARE;
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

  const ratingCount = signals.length;
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

