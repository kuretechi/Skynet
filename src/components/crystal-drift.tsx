"use client";

import { useEffect, useState } from "react";
import { CinemaCrystal } from "@/components/cinema-crystal";
import { AXES, type AxisVector } from "@/lib/dna/axes";

const SEED: AxisVector = {
  feel: 0.72,
  think: 0.86,
  immerse: 0.9,
  story: 0.6,
  sense: 0.88,
  pulse: 0.4,
  explore: 0.78,
  depth: 0.84,
};

const TRANSITION_MS = 4200;
const HOLD_MS = 1400;

const randomVector = (): AxisVector =>
  Object.fromEntries(AXES.map((axis) => [axis, 0.32 + Math.random() * 0.62])) as AxisVector;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const mix = (from: AxisVector, to: AxisVector, t: number): AxisVector =>
  Object.fromEntries(
    AXES.map((axis) => [axis, from[axis] + (to[axis] - from[axis]) * t]),
  ) as AxisVector;

/**
 * Landing-page crystal. The shape morphs slowly between random DNA readings so
 * the axes stay legible, instead of spinning.
 */
export function CrystalDrift({ size = 280 }: { size?: number }) {
  const [vector, setVector] = useState<AxisVector>(SEED);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let from = SEED;
    let to = randomVector();
    let start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;

      if (elapsed >= TRANSITION_MS + HOLD_MS) {
        from = to;
        to = randomVector();
        start = now;
      } else {
        setVector(mix(from, to, easeInOut(Math.min(1, elapsed / TRANSITION_MS))));
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <CinemaCrystal vector={vector} size={size} />;
}
