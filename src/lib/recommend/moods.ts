import type { AxisVector } from "@/lib/dna/axes";

/** Mood Search presets: each mood is a target point in the same 8-axis space. */
export const MOODS: { id: string; label: string; target: AxisVector }[] = [
  {
    id: "cry",
    label: "泣きたい",
    target: { feel: 0.95, think: 0.5, immerse: 0.55, story: 0.6, sense: 0.65, pulse: 0.25, explore: 0.35, depth: 0.9 },
  },
  {
    id: "laugh",
    label: "笑いたい",
    target: { feel: 0.6, think: 0.35, immerse: 0.45, story: 0.55, sense: 0.5, pulse: 0.6, explore: 0.3, depth: 0.15 },
  },
  {
    id: "think",
    label: "考えたい",
    target: { feel: 0.4, think: 0.95, immerse: 0.6, story: 0.6, sense: 0.6, pulse: 0.3, explore: 0.75, depth: 0.9 },
  },
  {
    id: "heal",
    label: "癒されたい",
    target: { feel: 0.8, think: 0.35, immerse: 0.55, story: 0.35, sense: 0.65, pulse: 0.1, explore: 0.3, depth: 0.3 },
  },
  {
    id: "immerse",
    label: "世界観に浸りたい",
    target: { feel: 0.55, think: 0.6, immerse: 0.97, story: 0.55, sense: 0.9, pulse: 0.45, explore: 0.7, depth: 0.7 },
  },
  {
    id: "thrill",
    label: "ゾクゾクしたい",
    target: { feel: 0.4, think: 0.55, immerse: 0.65, story: 0.75, sense: 0.65, pulse: 0.95, explore: 0.45, depth: 0.6 },
  },
  {
    id: "easy",
    label: "何も考えず楽しみたい",
    target: { feel: 0.5, think: 0.2, immerse: 0.7, story: 0.5, sense: 0.7, pulse: 0.85, explore: 0.2, depth: 0.15 },
  },
];

export const getMood = (id: string | undefined | null) => MOODS.find((m) => m.id === id) ?? null;
