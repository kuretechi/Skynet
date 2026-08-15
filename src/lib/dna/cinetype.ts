import { AXES, type Axis, type AxisVector, euclideanDistance } from "./axes";

export type CineType = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  center: AxisVector;
};

const v = (feel: number, think: number, immerse: number, story: number, sense: number, pulse: number, explore: number, depth: number): AxisVector => ({
  feel,
  think,
  immerse,
  story,
  sense,
  pulse,
  explore,
  depth,
});

/**
 * Initial 16 CineTypes (spec v0.2 §25.1-8). Names and centre vectors are
 * provisional product data and intentionally kept in one editable table.
 */
export const CINE_TYPES: CineType[] = [
  {
    id: "visionary",
    name: "THE VISIONARY",
    tagline: "世界の設計図を読む人",
    description: "壮大な世界観と映像設計に強く反応する。物語よりも、世界そのものの構造に惹かれる。",
    accent: "#7dd3fc",
    center: v(0.5, 0.8, 0.95, 0.6, 0.9, 0.5, 0.8, 0.8),
  },
  {
    id: "dreamer",
    name: "THE DREAMER",
    tagline: "余韻の中に住む人",
    description: "静かな情感と幻想性を好む。観終えたあとの余白こそが本編だと感じるタイプ。",
    accent: "#c4b5fd",
    center: v(0.9, 0.55, 0.85, 0.45, 0.8, 0.2, 0.6, 0.85),
  },
  {
    id: "thinker",
    name: "THE THINKER",
    tagline: "解釈を持ち帰る人",
    description: "解釈余地・哲学性・曖昧さを歓迎する。答えの出ない映画ほど長く付き合える。",
    accent: "#a3e635",
    center: v(0.4, 0.97, 0.6, 0.55, 0.6, 0.25, 0.8, 0.9),
  },
  {
    id: "aesthete",
    name: "THE AESTHETE",
    tagline: "画で記憶する人",
    description: "構図・色・音の美意識で映画を選ぶ。物語より一瞬のショットを愛する。",
    accent: "#fbbf24",
    center: v(0.6, 0.5, 0.75, 0.4, 0.98, 0.35, 0.6, 0.65),
  },
  {
    id: "empath",
    name: "THE EMPATH",
    tagline: "人の心に触れる人",
    description: "登場人物の感情に深く同調する。派手さより人間の機微に価値を見出す。",
    accent: "#fda4af",
    center: v(0.98, 0.5, 0.5, 0.6, 0.55, 0.3, 0.3, 0.8),
  },
  {
    id: "explorer",
    name: "THE EXPLORER",
    tagline: "地図の外を歩く人",
    description: "実験的・未知・非主流の作品に惹かれる。誰も薦めない一本を掘り当てる。",
    accent: "#5eead4",
    center: v(0.5, 0.8, 0.7, 0.45, 0.75, 0.4, 0.98, 0.75),
  },
  {
    id: "storyteller",
    name: "THE STORYTELLER",
    tagline: "構造に酔う人",
    description: "緻密なプロット、伏線、どんでん返し。物語の設計そのものを味わう。",
    accent: "#93c5fd",
    center: v(0.6, 0.7, 0.55, 0.98, 0.55, 0.6, 0.45, 0.6),
  },
  {
    id: "thrill_seeker",
    name: "THE THRILL SEEKER",
    tagline: "鼓動で観る人",
    description: "緊張、疾走、衝撃。体感的な強度が高い映画で満たされる。",
    accent: "#f87171",
    center: v(0.45, 0.4, 0.65, 0.6, 0.7, 0.98, 0.4, 0.4),
  },
  {
    id: "archivist",
    name: "THE ARCHIVIST",
    tagline: "時代を横断する人",
    description: "古典と現代を等距離で愛する。映画史そのものが個人の棚になる。",
    accent: "#d6d3d1",
    center: v(0.6, 0.8, 0.6, 0.6, 0.7, 0.25, 0.85, 0.9),
  },
  {
    id: "wanderer",
    name: "THE WANDERER",
    tagline: "日常を旅する人",
    description: "静かな時間の流れ、生活の断片、名もない風景を好む。",
    accent: "#bef264",
    center: v(0.8, 0.6, 0.6, 0.35, 0.7, 0.12, 0.6, 0.7),
  },
  {
    id: "romantic",
    name: "THE ROMANTIC",
    tagline: "距離と longing の人",
    description: "報われない距離、抑制された感情、まなざしの映画に強く反応する。",
    accent: "#f0abfc",
    center: v(0.95, 0.5, 0.65, 0.55, 0.8, 0.25, 0.4, 0.75),
  },
  {
    id: "analyst",
    name: "THE ANALYST",
    tagline: "仕組みを解く人",
    description: "情報密度と論理構造を好む。会話劇、システム、緻密な工程に惹かれる。",
    accent: "#67e8f9",
    center: v(0.35, 0.9, 0.45, 0.85, 0.5, 0.55, 0.5, 0.6),
  },
  {
    id: "minimalist",
    name: "THE MINIMALIST",
    tagline: "引き算を信じる人",
    description: "説明を削ぎ落とした静けさを好む。何も起きない時間に耐えられる強さがある。",
    accent: "#e7e5e4",
    center: v(0.7, 0.7, 0.5, 0.3, 0.7, 0.1, 0.65, 0.85),
  },
  {
    id: "adventurer",
    name: "THE ADVENTURER",
    tagline: "連れ出される人",
    description: "冒険、スケール、高揚。映画館の椅子ごと運ばれる体験を求める。",
    accent: "#fdba74",
    center: v(0.6, 0.4, 0.9, 0.65, 0.8, 0.85, 0.5, 0.4),
  },
  {
    id: "alchemist",
    name: "THE ALCHEMIST",
    tagline: "混ざりものを愛する人",
    description: "ジャンルの越境、トーンの飛躍、破調。定義できない映画ほど強く刺さる。",
    accent: "#c084fc",
    center: v(0.75, 0.75, 0.8, 0.7, 0.85, 0.7, 0.9, 0.6),
  },
  {
    id: "witness",
    name: "THE WITNESS",
    tagline: "現実を見届ける人",
    description: "社会、記録、人間の現実。目を逸らさない映画に価値を置く。",
    accent: "#94a3b8",
    center: v(0.7, 0.85, 0.4, 0.65, 0.5, 0.45, 0.6, 0.95),
  },
];

export const getCineType = (id: string | null | undefined) =>
  CINE_TYPES.find((t) => t.id === id) ?? null;

const centered = (vec: AxisVector): AxisVector =>
  AXES.reduce((acc, axis) => ({ ...acc, [axis]: vec[axis] - 0.5 }), {} as AxisVector);

const cosine = (a: AxisVector, b: AxisVector) => {
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

export type CineTypeMatch = { type: CineType; similarity: number };

/**
 * CineType is decided by similarity between the user's 8-axis vector and each
 * type centre. Vectors are mean-centred so the shape of the taste, not its
 * overall magnitude, drives the result.
 */
export function rankCineTypes(userVector: AxisVector): CineTypeMatch[] {
  const u = centered(userVector);
  const flat = AXES.every((axis) => Math.abs(u[axis]) < 0.02);
  return CINE_TYPES.map((type) => ({
    type,
    similarity: flat
      ? 1 - euclideanDistance(userVector, type.center) / Math.sqrt(AXES.length)
      : (cosine(u, centered(type.center)) + 1) / 2,
  })).sort((a, b) => b.similarity - a.similarity);
}

export const bestCineType = (userVector: AxisVector) => rankCineTypes(userVector)[0];

export const topAxes = (vec: AxisVector, count = 3): Axis[] =>
  [...AXES].sort((a, b) => vec[b] - vec[a]).slice(0, count);
