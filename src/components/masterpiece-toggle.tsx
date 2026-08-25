"use client";

import { useState, useTransition } from "react";
import { toggleMasterpieceAction } from "@/lib/actions";

export const MASTERPIECE_PATH =
  "M12 2.2l2.35 4.05 4.55.98-3.1 3.5.5 4.64L12 13.5l-4.3 1.87.5-4.64-3.1-3.5 4.55-.98z";

/** Above the stars: one mark reserved for the films that define your taste. */
export function MasterpieceToggle({
  providerId,
  initial,
  onChange,
}: {
  providerId: string;
  initial: boolean;
  onChange?: (marked: boolean) => void;
}) {
  const [marked, setMarked] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const previous = marked;
    setMarked(!previous);
    onChange?.(!previous);
    setError(null);
    startTransition(async () => {
      const result = await toggleMasterpieceAction(providerId);
      if (result?.error) {
        setMarked(previous);
        onChange?.(previous);
        setError(result.error);
        return;
      }
      const next = result.masterpiece ?? !previous;
      setMarked(next);
      onChange?.(next);
    });
  };

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={marked}
        className="label flex items-center gap-2 self-start border px-3 py-2 transition-colors"
        style={{
          borderColor: marked ? "var(--masterpiece)" : "var(--line)",
          color: marked ? "var(--masterpiece)" : "var(--muted)",
          background: marked ? "color-mix(in srgb, var(--masterpiece) 12%, transparent)" : "transparent",
        }}
      >
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
          <path
            d={MASTERPIECE_PATH}
            fill={marked ? "var(--masterpiece)" : "none"}
            stroke="currentColor"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </svg>
        MASTERPIECE
      </button>
      <p className="text-xs text-[var(--muted)]">
        {marked
          ? "殿堂入り。DNA では星評価より強く効きます。"
          : "星より上の評価。DNA に最大の重みで反映されます。"}
      </p>
      {error ? (
        <span role="alert" className="font-mono text-xs text-[var(--accent)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
