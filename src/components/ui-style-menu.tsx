"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_UI_STYLE,
  isUiStyleId,
  UI_STYLES,
  UI_STYLE_STORAGE_KEY,
  type UiStyleId,
} from "@/lib/ui-style";

export function applyUiStyle(style: UiStyleId) {
  document.documentElement.dataset.ui = style;
}

export function UiStyleMenu() {
  const [style, setStyle] = useState<UiStyleId>(DEFAULT_UI_STYLE);

  useEffect(() => {
    const stored = window.localStorage.getItem(UI_STYLE_STORAGE_KEY);
    if (isUiStyleId(stored)) setStyle(stored);
  }, []);

  const select = (next: UiStyleId) => {
    setStyle(next);
    window.localStorage.setItem(UI_STYLE_STORAGE_KEY, next);
    applyUiStyle(next);
  };

  return (
    <div role="radiogroup" aria-label="UIスタイル" className="grid grid-cols-2 gap-3">
      {UI_STYLES.map((entry) => {
        const active = entry.id === style;
        return (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(entry.id)}
            className="ui-style-option flex min-h-28 flex-col justify-between border px-4 py-4 text-left"
            style={{
              borderColor: active ? "var(--accent)" : "var(--line)",
              background: active ? "var(--surface-2)" : "transparent",
            }}
          >
            <span aria-hidden className={entry.id === "pop" ? "flex items-center gap-2" : "flex gap-1.5"}>
              {entry.id === "pop" ? (
                <><span className="h-7 w-7 rounded-full bg-[var(--accent)]" /><span className="h-5 flex-1 rounded-lg bg-[var(--surface)]" /></>
              ) : (
                <><span className="h-7 w-px bg-[var(--foreground)]" /><span className="h-7 w-px bg-[var(--line)]" /><span className="h-px flex-1 bg-[var(--line)]" /></>
              )}
            </span>
            <span>
              <span className="block text-xs font-semibold text-[var(--foreground)]">{entry.name}</span>
              <span className="mt-1 block text-[10px] leading-snug text-[var(--muted)]">{entry.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
