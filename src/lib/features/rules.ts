import { AXES, type AxisVector, clampVector, zeroVector } from "@/lib/dna/axes";
import type { ProviderMovieDetail } from "@/lib/movies/types";

type Partials = Partial<AxisVector>;

/** Deterministic genre → axis contributions (added on top of a neutral base). */
const GENRE_SIGNALS: Record<string, Partials> = {
  Drama: { feel: 0.22, depth: 0.15, story: 0.08 },
  Romance: { feel: 0.26, sense: 0.08, depth: 0.06 },
  "Science Fiction": { think: 0.2, immerse: 0.22, explore: 0.18 },
  Fantasy: { immerse: 0.26, sense: 0.14, explore: 0.12 },
  Animation: { sense: 0.18, immerse: 0.14, feel: 0.08 },
  Thriller: { pulse: 0.24, story: 0.12, depth: 0.05 },
  Mystery: { think: 0.2, story: 0.16, pulse: 0.08 },
  Horror: { pulse: 0.24, depth: 0.1, sense: 0.06 },
  Action: { pulse: 0.3, story: 0.05 },
  Adventure: { immerse: 0.16, pulse: 0.14, explore: 0.08 },
  Comedy: { feel: 0.1, pulse: 0.06, depth: -0.1 },
  Family: { feel: 0.14, depth: -0.08 },
  Music: { sense: 0.22, feel: 0.12 },
  History: { depth: 0.14, story: 0.1, immerse: 0.08 },
  War: { depth: 0.18, pulse: 0.12, feel: 0.1 },
  Crime: { story: 0.14, pulse: 0.14, depth: 0.06 },
  Documentary: { think: 0.24, explore: 0.14, story: -0.05 },
  Western: { immerse: 0.14, depth: 0.08 },
};

/**
 * Providers return genre names in the configured display language, so rule
 * matching normalises them back to the canonical keys of GENRE_SIGNALS.
 */
const GENRE_ALIASES: Record<string, string> = {
  アクション: "Action",
  アドベンチャー: "Adventure",
  アニメーション: "Animation",
  コメディ: "Comedy",
  犯罪: "Crime",
  ドキュメンタリー: "Documentary",
  ドラマ: "Drama",
  ファミリー: "Family",
  ファンタジー: "Fantasy",
  歴史: "History",
  履歴: "History",
  ホラー: "Horror",
  音楽: "Music",
  ミステリー: "Mystery",
  謎: "Mystery",
  ロマンス: "Romance",
  恋愛: "Romance",
  サイエンスフィクション: "Science Fiction",
  SF: "Science Fiction",
  スリラー: "Thriller",
  戦争: "War",
  西部劇: "Western",
  西洋: "Western",
};

export const canonicalGenre = (genre: string) => GENRE_ALIASES[genre] ?? genre;

/** Keyword → axis contributions. Matching is substring based and case-insensitive. */
const KEYWORD_SIGNALS: Record<string, Partials> = {
  philosophical: { think: 0.2, depth: 0.16 },
  ambiguous: { think: 0.16, depth: 0.14, explore: 0.1 },
  experimental: { explore: 0.24, sense: 0.12, think: 0.1 },
  surreal: { explore: 0.2, sense: 0.14 },
  quiet: { feel: 0.1, depth: 0.14, pulse: -0.18 },
  slow: { depth: 0.14, pulse: -0.2 },
  contemplative: { think: 0.14, depth: 0.16, pulse: -0.14 },
  melancholy: { feel: 0.2, depth: 0.14 },
  grief: { feel: 0.24, depth: 0.18 },
  emotional: { feel: 0.24 },
  heartwarming: { feel: 0.2, depth: -0.06 },
  comfort: { feel: 0.14, pulse: -0.14, depth: -0.12 },
  gentle: { feel: 0.12, pulse: -0.12 },
  dark: { depth: 0.16, feel: 0.06 },
  grim: { depth: 0.16 },
  dread: { pulse: 0.16, depth: 0.12 },
  violent: { pulse: 0.18 },
  twist: { story: 0.22, think: 0.1 },
  puzzle: { think: 0.2, story: 0.18 },
  complex: { think: 0.2, story: 0.12 },
  layered: { think: 0.16, depth: 0.1 },
  "dialogue heavy": { think: 0.16, story: 0.12, pulse: -0.08 },
  worldbuilding: { immerse: 0.26, explore: 0.1 },
  epic: { immerse: 0.2, sense: 0.12 },
  visual: { sense: 0.26 },
  stylised: { sense: 0.22, explore: 0.08 },
  color: { sense: 0.16 },
  "practical effects": { sense: 0.14, pulse: 0.1 },
  kinetic: { pulse: 0.24 },
  chase: { pulse: 0.22 },
  tension: { pulse: 0.18 },
  "slow burn": { depth: 0.14, pulse: -0.1 },
  longing: { feel: 0.2, depth: 0.1 },
  romance: { feel: 0.18 },
  humor: { feel: 0.08, depth: -0.08 },
  witty: { think: 0.1, feel: 0.06 },
  fun: { pulse: 0.12, depth: -0.12 },
  classic: { depth: 0.1 },
  restraint: { depth: 0.14, pulse: -0.12, feel: 0.1 },
};

const add = (target: AxisVector, partials: Partials, weight = 1) => {
  for (const axis of AXES) {
    const value = partials[axis];
    if (value !== undefined) target[axis] += value * weight;
  }
};

export type RuleSignals = {
  vector: AxisVector;
  matchedGenres: string[];
  matchedKeywords: string[];
};

/**
 * Deterministic 8-axis estimate derived from structured metadata only.
 * Used alone when no LLM is configured, and as a prior/corrective otherwise.
 */
export function generateRuleFeatures(movie: ProviderMovieDetail): RuleSignals {
  const vector = zeroVector();
  for (const axis of AXES) vector[axis] = 0.4;

  const matchedGenres: string[] = [];
  for (const genre of movie.genres) {
    const canonical = canonicalGenre(genre);
    const signal = GENRE_SIGNALS[canonical];
    if (signal) {
      add(vector, signal);
      matchedGenres.push(canonical);
    }
  }

  const haystack = [...movie.keywords, ...(movie.overview ? [movie.overview] : [])]
    .join(" ")
    .toLowerCase();
  const matchedKeywords: string[] = [];
  for (const [keyword, signal] of Object.entries(KEYWORD_SIGNALS)) {
    if (haystack.includes(keyword)) {
      add(vector, signal, 0.8);
      matchedKeywords.push(keyword);
    }
  }

  const runtime = movie.runtime ?? 110;
  if (runtime >= 150) add(vector, { depth: 0.12, immerse: 0.08, pulse: -0.08 });
  else if (runtime <= 95) add(vector, { pulse: 0.06, depth: -0.06 });

  const year = Number(movie.releaseDate?.slice(0, 4) ?? 0);
  if (year && year < 1980) add(vector, { depth: 0.1, explore: 0.1, pulse: -0.08 });

  // Low popularity / low vote count reads as "outside the mainstream".
  if (movie.popularity < 40) add(vector, { explore: 0.12 });
  if (movie.popularity > 85) add(vector, { explore: -0.1, pulse: 0.05 });
  if (movie.voteAverage >= 8) add(vector, { depth: 0.06, story: 0.05 });

  return { vector: clampVector(vector), matchedGenres, matchedKeywords };
}
