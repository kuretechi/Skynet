"use client";

import { useState, useTransition } from "react";
import { rateMovieAction } from "@/lib/actions";

const STEPS = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);

/** 0.5–5.0 rating in 0.5 steps. A single tap completes the rating. */
export function RatingInput({
  providerId,
  initialScore,
  onRated,
  compact = false,
}: {
  providerId: string;
  initialScore?: number | null;
  onRated?: (score: number) => void;
  compact?: boolean;
}) {
  const [score, setScore] = useState(initialScore ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = hover ?? score;

  const submit = (value: number) => {
    const previous = score;
    setScore(value);
    setError(null);
    startTransition(async () => {
      const result = await rateMovieAction(providerId, value);
      if (result?.error) {
        setScore(previous);
        setError(result.error);
        return;
      }
      onRated?.(value);
    });
  };

  return (
    <div className="flex items-center gap-3" aria-busy={pending}>
      <div className="flex" onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((starIndex) => {
          const full = STEPS[starIndex * 2 + 1];
          const half = STEPS[starIndex * 2];
          const fill = Math.min(1, Math.max(0, shown - starIndex));
          return (
            <span key={starIndex} className="relative" style={{ width: compact ? 20 : 28, height: compact ? 20 : 28 }}>
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full">
                <defs>
                  <linearGradient id={`star-${providerId}-${starIndex}`}>
                    <stop offset={`${fill * 100}%`} stopColor="var(--accent)" />
                    <stop offset={`${fill * 100}%`} stopColor="transparent" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z"
                  fill={`url(#star-${providerId}-${starIndex})`}
                  stroke="var(--accent)"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                />
              </svg>
              <button
                type="button"
                aria-label={`${half} 点`}
                className="absolute inset-y-0 left-0 w-1/2"
                onMouseEnter={() => setHover(half)}
                onClick={() => submit(half)}
              />
              <button
                type="button"
                aria-label={`${full} 点`}
                className="absolute inset-y-0 right-0 w-1/2"
                onMouseEnter={() => setHover(full)}
                onClick={() => submit(full)}
              />
            </span>
          );
        })}
      </div>
      <span className="font-mono text-xs text-[var(--muted)]">
        {shown ? shown.toFixed(1) : "—"}
        {pending ? " …" : ""}
      </span>
      {error ? (
        <span role="alert" className="font-mono text-xs text-[var(--accent)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
