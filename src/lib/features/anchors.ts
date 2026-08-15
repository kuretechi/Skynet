import type { AxisVector } from "@/lib/dna/axes";

/**
 * Anchor movies keep the LLM classifier calibrated across runs and feature
 * versions. Values are human-reviewed. The full anchor set is expected to grow
 * to 50–100 titles (spec §9.7); this is the initial seed.
 */
export const ANCHOR_MOVIES: { title: string; year: number; vector: AxisVector }[] = [
  {
    title: "Arrival",
    year: 2016,
    vector: { feel: 0.82, think: 0.88, immerse: 0.7, story: 0.72, sense: 0.74, pulse: 0.35, explore: 0.6, depth: 0.86 },
  },
  {
    title: "Mad Max: Fury Road",
    year: 2015,
    vector: { feel: 0.35, think: 0.3, immerse: 0.78, story: 0.4, sense: 0.9, pulse: 0.98, explore: 0.5, depth: 0.28 },
  },
  {
    title: "Tokyo Story",
    year: 1953,
    vector: { feel: 0.88, think: 0.6, immerse: 0.4, story: 0.5, sense: 0.55, pulse: 0.1, explore: 0.3, depth: 0.9 },
  },
  {
    title: "Paddington 2",
    year: 2017,
    vector: { feel: 0.72, think: 0.2, immerse: 0.5, story: 0.55, sense: 0.6, pulse: 0.45, explore: 0.2, depth: 0.15 },
  },
  {
    title: "2001: A Space Odyssey",
    year: 1968,
    vector: { feel: 0.3, think: 0.95, immerse: 0.85, story: 0.35, sense: 0.92, pulse: 0.2, explore: 0.95, depth: 0.9 },
  },
  {
    title: "Parasite",
    year: 2019,
    vector: { feel: 0.62, think: 0.78, immerse: 0.6, story: 0.9, sense: 0.7, pulse: 0.75, explore: 0.45, depth: 0.72 },
  },
  {
    title: "Spirited Away",
    year: 2001,
    vector: { feel: 0.75, think: 0.45, immerse: 0.95, story: 0.65, sense: 0.88, pulse: 0.45, explore: 0.7, depth: 0.55 },
  },
  {
    title: "Se7en",
    year: 1995,
    vector: { feel: 0.4, think: 0.6, immerse: 0.65, story: 0.8, sense: 0.7, pulse: 0.72, explore: 0.35, depth: 0.78 },
  },
];

export const anchorPromptBlock = () =>
  ANCHOR_MOVIES.map(
    (a) =>
      `${a.title} (${a.year}): ${Object.entries(a.vector)
        .map(([k, v]) => `${k}=${v.toFixed(2)}`)
        .join(", ")}`,
  ).join("\n");
