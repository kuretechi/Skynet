import { AXIS_LABELS, type Axis, type AxisVector } from "./axes";

/**
 * Type Code: the 8 axes read as 4 opposing pairs, one letter each, so a taste
 * can be named symbolically (TSPE, FNDI, ...) the way MBTI does. The pairs are
 * the opposite faces of the Taste Universe octahedron, so the code and the 3D
 * map describe the same geometry. The CineType name stays as the subtitle.
 */
export type CodePair = {
  id: string;
  positive: { axis: Axis; letter: string; word: string };
  negative: { axis: Axis; letter: string; word: string };
};

export const CODE_PAIRS: CodePair[] = [
  {
    id: "mind",
    positive: { axis: "think", letter: "T", word: "思考" },
    negative: { axis: "feel", letter: "F", word: "情動" },
  },
  {
    id: "surface",
    positive: { axis: "sense", letter: "S", word: "感覚" },
    negative: { axis: "story", letter: "N", word: "物語" },
  },
  {
    id: "tempo",
    positive: { axis: "pulse", letter: "P", word: "衝動" },
    negative: { axis: "depth", letter: "D", word: "余韻" },
  },
  {
    id: "reach",
    positive: { axis: "explore", letter: "E", word: "探索" },
    negative: { axis: "immerse", letter: "I", word: "没入" },
  },
];

export type CodeLetter = {
  pair: CodePair;
  side: "positive" | "negative";
  letter: string;
  axis: Axis;
  label: string;
  /** How far this pair leans, 0 = perfectly balanced, 1 = one axis only. */
  lean: number;
};

export type CineCode = {
  code: string;
  letters: CodeLetter[];
};

/**
 * A pair leans to whichever of its two axes scores higher; the margin is
 * reported as a 0..1 lean so the UI can show how decided each letter is.
 */
export const cineCode = (vector: AxisVector): CineCode => {
  const letters = CODE_PAIRS.map((pair) => {
    const positive = vector[pair.positive.axis];
    const negative = vector[pair.negative.axis];
    const side = positive >= negative ? "positive" : "negative";
    const chosen = pair[side];
    const total = positive + negative;
    return {
      pair,
      side,
      letter: chosen.letter,
      axis: chosen.axis,
      label: AXIS_LABELS[chosen.axis].label,
      lean: total === 0 ? 0 : Math.abs(positive - negative) / total,
    } satisfies CodeLetter;
  });
  return { code: letters.map((l) => l.letter).join(""), letters };
};

/** Share of the pair held by its positive axis, for a two-sided meter. */
export const pairShare = (vector: AxisVector, pair: CodePair) => {
  const total = vector[pair.positive.axis] + vector[pair.negative.axis];
  return total === 0 ? 0.5 : vector[pair.positive.axis] / total;
};
