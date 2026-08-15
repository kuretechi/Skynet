"use client";

import { useEffect, useState } from "react";
import { ShelfGrid } from "@/components/shelf-grid";
import { ShelfRack, type ShelfItem } from "@/components/shelf-rack";

type View = "rack" | "grid";

const VIEW_STORAGE_KEY = "pc-shelf-view";

/** Shelf header plus its body, in whichever view the reader last chose. */
export function ShelfSection({
  title,
  caption,
  items,
}: {
  title: string;
  caption: string;
  items: ShelfItem[];
}) {
  const [view, setView] = useState<View>("rack");

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "rack" || stored === "grid") setView(stored);
  }, []);

  const choose = (next: View) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
        <h2 className="label">{title}</h2>
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] text-[var(--muted)]">{caption}</span>
          {items.length > 0 ? (
            <div className="flex gap-2" role="group" aria-label="表示切替">
              {(["rack", "grid"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => choose(option)}
                  aria-pressed={view === option}
                  className="label px-1 py-0.5"
                  style={{ color: view === option ? "var(--accent)" : "var(--muted)" }}
                >
                  {option === "rack" ? "VHS" : "GRID"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[2px] border border-dashed border-[var(--line)] px-4 py-6 text-center text-xs text-[var(--muted)]">
          まだ空の棚です。映画詳細から追加できます。
        </p>
      ) : view === "rack" ? (
        <ShelfRack items={items} />
      ) : (
        <ShelfGrid items={items} />
      )}
    </section>
  );
}
