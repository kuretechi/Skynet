/**
 * The 8 user-facing Cinema DNA axes confirmed in spec v0.2 (§25.1).
 * Internal, finer-grained features are projected onto these axes.
 */
export const AXES = ["feel", "think", "immerse", "story", "sense", "pulse", "explore", "depth"] as const;

export type Axis = (typeof AXES)[number];

export type AxisVector = Record<Axis, number>;

export const AXIS_LABELS: Record<Axis, { label: string; caption: string }> = {
  feel: { label: "FEEL", caption: "感情の揺れ・情緒への反応" },
  think: { label: "THINK", caption: "思考・解釈・知的刺激" },
  immerse: { label: "IMMERSE", caption: "世界観への没入" },
  story: { label: "STORY", caption: "物語構造・プロットの強度" },
  sense: { label: "SENSE", caption: "映像・音・美意識" },
  pulse: { label: "PULSE", caption: "疾走感・緊張・鼓動" },
  explore: { label: "EXPLORE", caption: "未知・実験・地図の外" },
  depth: { label: "DEPTH", caption: "余韻・重さ・深度" },
};

export const zeroVector = (): AxisVector =>
  AXES.reduce((acc, axis) => ({ ...acc, [axis]: 0 }), {} as AxisVector);

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const clampVector = (v: AxisVector): AxisVector =>
  AXES.reduce((acc, axis) => ({ ...acc, [axis]: Number(clamp01(v[axis]).toFixed(4)) }), {} as AxisVector);

export const mixVectors = (a: AxisVector, b: AxisVector, weightA: number): AxisVector =>
  clampVector(
    AXES.reduce(
      (acc, axis) => ({ ...acc, [axis]: a[axis] * weightA + b[axis] * (1 - weightA) }),
      {} as AxisVector,
    ),
  );

export const cosineSimilarity = (a: AxisVector, b: AxisVector) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const axis of AXES) {
    dot += a[axis] * b[axis];
    na += a[axis] ** 2;
    nb += b[axis] ** 2;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export const euclideanDistance = (a: AxisVector, b: AxisVector) =>
  Math.sqrt(AXES.reduce((sum, axis) => sum + (a[axis] - b[axis]) ** 2, 0));

export const pickVector = (source: Record<string, unknown>): AxisVector =>
  AXES.reduce((acc, axis) => ({ ...acc, [axis]: Number(source[axis] ?? 0) }), {} as AxisVector);
