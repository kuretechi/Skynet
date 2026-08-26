import { AXES, type Axis, type AxisVector } from "@/lib/dna/axes";

export type ForYouScore = {
  /** Predicted personal rating on the 0.5–5.0 scale. */
  predicted: number;
  /** 0–100 personal content match. */
  match: number;
  /** 0–1 confidence in the prediction. */
  confidence: number;
  /** Optional 0–100 match for the request-scoped mood target. */
  moodMatch?: number;
};

/** Axes where the user's visual DNA and the movie both run strong. */
export function sharedStrengths(dna: AxisVector, movie: AxisVector, count = 3): Axis[] {
  return [...AXES]
    .map((axis) => ({ axis, score: Math.min(dna[axis], movie[axis]) * (1 - Math.abs(dna[axis] - movie[axis])) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((item) => item.axis);
}
