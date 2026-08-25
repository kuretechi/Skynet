"use client";

import { useState, useTransition } from "react";
import { toggleShelfAction } from "@/lib/actions";

/**
 * One tap adds the movie to the "want to watch" shelf from anywhere it is
 * listed, so the watchlist fills up without opening the movie page.
 */
export function WatchlistButton({
  providerId,
  initial = false,
  variant = "label",
}: {
  providerId: string;
  initial?: boolean;
  variant?: "label" | "icon";
}) {
  const [added, setAdded] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const previous = added;
    setAdded(!previous);
    startTransition(async () => {
      const result = await toggleShelfAction(providerId, "want_to_watch");
      if (result?.error) {
        setAdded(previous);
        return;
      }
      setAdded(result.added ?? !previous);
    });
  };

  const title = added ? "ウォッチリストから外す" : "ウォッチリストに追加";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={added}
      aria-label={title}
      title={title}
      disabled={pending}
      className={
        variant === "icon"
          ? "flex h-7 w-7 items-center justify-center border text-sm leading-none"
          : "label shrink-0 border px-2 py-1 text-[10px]"
      }
      style={{
        borderColor: added ? "var(--accent)" : "var(--line)",
        color: added ? "var(--accent)" : "var(--muted)",
        background: added ? "rgba(216,166,87,0.12)" : "var(--surface)",
      }}
    >
      {variant === "icon" ? (added ? "✓" : "＋") : added ? "IN WATCHLIST" : "＋ WATCHLIST"}
    </button>
  );
}
