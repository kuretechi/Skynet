"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId, type ThemeId } from "@/lib/theme";

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  const color = THEMES.find((entry) => entry.id === theme)?.color;
  if (meta && color) meta.setAttribute("content", color);
}

export function ThemeMenu() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) setTheme(stored);
  }, []);

  const select = (next: ThemeId) => {
    setTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  };

  return (
    <div role="radiogroup" aria-label="テーマ" className="grid grid-cols-2 gap-3">
      {THEMES.map((entry) => {
        const active = entry.id === theme;
        return (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(entry.id)}
            className="flex flex-col gap-2 border px-3 py-3 text-left"
            style={{
              borderColor: active ? "var(--accent)" : "var(--line)",
              background: active ? "var(--surface-2)" : "transparent",
            }}
          >
            <span aria-hidden className="flex gap-1">
              {["--background", "--surface-2", "--accent"].map((token) => (
                <span
                  key={token}
                  className="h-4 w-4 rounded-full border border-[var(--line)]"
                  data-theme={entry.id}
                  style={{ background: `var(${token})` }}
                />
              ))}
            </span>
            <span className="text-xs text-[var(--foreground)]">{entry.name}</span>
            <span className="text-[10px] leading-tight text-[var(--muted)]">{entry.note}</span>
          </button>
        );
      })}
    </div>
  );
}
