import { AXES, AXIS_LABELS, type Axis, type AxisVector, euclideanDistance } from "@/lib/dna/axes";

export type ForYouInput = {
  dna: AxisVector;
  dnaConfidence: number;
  movie: AxisVector;
  userMeanRating: number;
  externalScore?: { score: number; scale: number; voteCount: number } | null;
};

export type ForYouScore = {
  /** Predicted personal rating on the 0.5–5.0 scale. */
  predicted: number;
  /** 0–100 taste match. */
  match: number;
  /** 0–1 confidence in the prediction. */
  confidence: number;
};

const importance = (dna: AxisVector): Record<Axis, number> =>
  AXES.reduce((acc, axis) => ({ ...acc, [axis]: Math.abs(dna[axis] - 0.5) * 2 }), {} as Record<Axis, number>);

const round = (n: number, digits = 1) => Number(n.toFixed(digits));

/**
 * Explainable content-based prediction (spec §10 Phase 1): the personal 8-axis
 * vector re-ranks candidates, external ratings act only as a weak prior.
 */
export function computeForYouScore({
  dna,
  dnaConfidence,
  movie,
  userMeanRating,
  externalScore,
}: ForYouInput): ForYouScore {
  const imp = importance(dna);
  const impSum = AXES.reduce((sum, axis) => sum + imp[axis], 0);

  const weightedDiff =
    impSum === 0
      ? 0.35
      : AXES.reduce((sum, axis) => sum + imp[axis] * Math.abs(dna[axis] - movie[axis]), 0) / impSum;

  const affinity = Math.max(0, Math.min(1, 1 - weightedDiff * 1.6));

  const base = Math.max(1.5, Math.min(4.5, userMeanRating || 3.4));
  let predicted = base + (affinity - 0.6) * 3.6;

  if (externalScore && externalScore.voteCount > 0) {
    const prior = (externalScore.score / externalScore.scale) * 5;
    // External signal matters most while the personal model is still thin.
    const priorWeight = 0.3 * (1 - dnaConfidence);
    predicted = predicted * (1 - priorWeight) + prior * priorWeight;
  }

  predicted = Math.max(0.5, Math.min(5, Math.round(predicted * 2) / 2));

  return {
    predicted,
    match: Math.round(affinity * 100),
    confidence: round(Math.min(1, 0.25 + dnaConfidence * 0.75), 2),
  };
}

export type Neighbour = { title: string; distance: number };

/** Highly rated movies closest to the candidate, used to explain the score. */
export function nearestLikedMovies(
  movie: AxisVector,
  liked: { title: string; vector: AxisVector }[],
  count = 2,
): Neighbour[] {
  return liked
    .map((l) => ({ title: l.title, distance: euclideanDistance(movie, l.vector) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

/** Axes where the user's preference and the movie both run strong. */
export function sharedStrengths(dna: AxisVector, movie: AxisVector, count = 3): Axis[] {
  return [...AXES]
    .map((axis) => ({ axis, score: Math.min(dna[axis], movie[axis]) * (1 - Math.abs(dna[axis] - movie[axis])) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.axis);
}

/**
 * `liked` must not contain the movie being explained, or the reason cites the
 * candidate as its own nearest neighbour.
 */
export function buildExplanation(
  dna: AxisVector,
  movie: AxisVector,
  liked: { title: string; vector: AxisVector }[],
): string {
  const axes = sharedStrengths(dna, movie).map((axis) => AXIS_LABELS[axis].label);
  const neighbours = nearestLikedMovies(movie, liked);
  if (neighbours.length === 0) {
    return `あなたの ${axes.join(" / ")} の傾向に近い特徴を持つ作品です。`;
  }
  const titles = neighbours.map((n) => `『${n.title}』`).join("");
  return `あなたが高く評価した${titles}と、${axes.join(" / ")} の特徴が近い作品です。`;
}
