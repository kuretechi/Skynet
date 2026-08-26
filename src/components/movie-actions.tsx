"use client";

import { useState, useTransition } from "react";
import { addToCustomShelfAction, toggleShelfAction } from "@/lib/actions";

type ShelfKind = "watched" | "favorites" | "want_to_watch";

const LABELS: Record<ShelfKind, string> = {
  watched: "WATCHED",
  favorites: "FAVORITE",
  want_to_watch: "WATCHLIST",
};

export function MovieActions({
  providerId,
  initial,
  customShelves,
}: {
  providerId: string;
  initial: Record<ShelfKind, boolean>;
  customShelves: { id: string; name: string; contains: boolean }[];
}) {
  const [state, setState] = useState(initial);
  const [shelves, setShelves] = useState(customShelves);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (kind: ShelfKind) => {
    setState((prev) => ({ ...prev, [kind]: !prev[kind] }));
    startTransition(async () => {
      await toggleShelfAction(providerId, kind);
    });
  };

  const toggleCustom = (shelfId: string) => {
    setShelves((prev) => prev.map((s) => (s.id === shelfId ? { ...s, contains: !s.contains } : s)));
    startTransition(async () => {
      await addToCustomShelfAction(providerId, shelfId);
    });
  };

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as ShelfKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => toggle(kind)}
            className="label border px-3 py-2 transition-colors"
            style={{
              borderColor: state[kind] ? "var(--accent)" : "var(--line)",
              color: state[kind] ? "var(--accent)" : "var(--muted)",
              background: state[kind] ? "rgba(216,166,87,0.08)" : "transparent",
            }}
          >
            {LABELS[kind]}
          </button>
        ))}
        {shelves.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="label border border-[var(--line)] px-3 py-2 text-[var(--muted)]"
          >
            + ADD TO SHELF
          </button>
        ) : null}
      </div>

      {open ? (
        <ul className="flex flex-wrap gap-2 border border-[var(--line)] bg-[var(--surface)] p-3">
          {shelves.map((shelf) => (
            <li key={shelf.id}>
              <button
                type="button"
                onClick={() => toggleCustom(shelf.id)}
                className="border px-3 py-1.5 text-xs transition-colors"
                style={{
                  borderColor: shelf.contains ? "var(--accent)" : "var(--line)",
                  color: shelf.contains ? "var(--accent)" : "var(--foreground)",
                }}
              >
                {shelf.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
