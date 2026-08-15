import { type AxisVector } from "@/lib/dna/axes";
import { CODE_PAIRS, cineCode, pairShare } from "@/lib/dna/code";

/**
 * The 4-letter Type Code, shown as the headline identity. Undecided letters
 * (a pair that barely leans) are rendered faint so a coin-flip does not read
 * as a firm trait.
 */
export function TypeCode({
  vector,
  accent,
  size = "lg",
}: {
  vector: AxisVector;
  accent?: string;
  size?: "sm" | "lg";
}) {
  const { letters } = cineCode(vector);
  return (
    <span
      className={`display flex items-baseline ${size === "lg" ? "gap-2 text-4xl" : "gap-1 text-base"}`}
      style={{ color: accent }}
    >
      {letters.map((letter) => (
        <span key={letter.pair.id} style={{ opacity: letter.lean < 0.04 ? 0.45 : 1 }}>
          {letter.letter}
        </span>
      ))}
    </span>
  );
}

/** Two-sided meters explaining where each letter of the code came from. */
export function TypeCodeMeters({ vector, accent }: { vector: AxisVector; accent?: string }) {
  const { letters } = cineCode(vector);
  return (
    <ul className="flex flex-col gap-4">
      {CODE_PAIRS.map((pair, index) => {
        const share = pairShare(vector, pair);
        const chosen = letters[index];
        return (
          <li key={pair.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between font-mono text-[11px] text-[var(--muted)]">
              <span style={{ color: chosen.side === "negative" ? accent : undefined }}>
                {pair.negative.letter} {pair.negative.word}
              </span>
              <span className="label">{chosen.pair[chosen.side].axis.toUpperCase()}</span>
              <span style={{ color: chosen.side === "positive" ? accent : undefined }}>
                {pair.positive.word} {pair.positive.letter}
              </span>
            </div>
            <div className="relative h-[3px] bg-[var(--line)]">
              <span
                className="absolute top-1/2 h-[9px] w-[2px] -translate-y-1/2 bg-[var(--muted)]"
                style={{ left: "50%" }}
              />
              <span
                className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${(share * 100).toFixed(1)}%`, background: accent ?? "var(--foreground)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
