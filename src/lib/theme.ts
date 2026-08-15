export const THEMES = [
  { id: "theater", name: "シアター", note: "暗室のようなデフォルト", color: "#08080a" },
  { id: "light", name: "ライト", note: "白を基調にした昼の書斎", color: "#f7f5f1" },
  { id: "cappuccino", name: "カプチーノ", note: "ベージュとアイボリーのコーヒー", color: "#ece2d5" },
  { id: "midnight", name: "ミッドナイト", note: "ネイビーとブルーグレー", color: "#101725" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "theater";
export const THEME_STORAGE_KEY = "pc-theme";

/** CineType accents are pastel, so blend them toward the theme's text colour to stay readable. */
export function typeInk(accent: string) {
  return `color-mix(in srgb, ${accent} 62%, var(--foreground))`;
}

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
