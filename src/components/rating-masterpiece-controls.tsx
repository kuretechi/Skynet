"use client";

import { useState } from "react";
import { MasterpieceToggle } from "./masterpiece-toggle";
import { RatingInput } from "./rating-input";

export function RatingMasterpieceControls({
  providerId,
  initialScore,
  initialMasterpiece,
}: {
  providerId: string;
  initialScore: number | null;
  initialMasterpiece: boolean;
}) {
  const [masterpiece, setMasterpiece] = useState(initialMasterpiece);

  return (
    <>
      <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
        <h2 className="label">Your Rating</h2>
        <span className="text-[10px] text-[var(--muted)]">
          {masterpiece ? "MASTERPIECE" : "0.5 — 5.0"}
        </span>
      </div>
      {!masterpiece ? <RatingInput providerId={providerId} initialScore={initialScore} /> : null}
      <MasterpieceToggle providerId={providerId} initial={initialMasterpiece} onChange={setMasterpiece} />
    </>
  );
}
