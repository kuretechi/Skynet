"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AxisVector } from "@/lib/dna/axes";

export type UniversePoint = {
  id: string;
  title: string;
  providerId: string;
  vector: AxisVector;
  rating: number | null;
  watched: boolean;
};

type Vec3 = { x: number; y: number; z: number };

/**
 * Taste Universe. One point = one movie, placed in a 3-axis feature space
 * carved out of the 8-axis DNA. The octahedron is the unit hull of that space:
 * its six vertices are the pure poles of each axis pair.
 */
const SPREAD = 2.6;
const clamp = (n: number) => Math.max(-1, Math.min(1, n * SPREAD));

const project3 = (v: AxisVector): Vec3 => ({
  x: clamp((v.think + v.explore + v.depth) / 3 - (v.feel + v.pulse + v.sense) / 3),
  y: clamp((v.sense + v.immerse) / 2 - (v.story + v.think) / 2),
  z: clamp((v.pulse + v.feel) / 2 - (v.depth + v.immerse) / 2),
});

const POLES: { axis: keyof Vec3; sign: 1 | -1; label: string }[] = [
  { axis: "x", sign: 1, label: "THINK" },
  { axis: "x", sign: -1, label: "FEEL" },
  { axis: "y", sign: 1, label: "SENSE" },
  { axis: "y", sign: -1, label: "STORY" },
  { axis: "z", sign: 1, label: "PULSE" },
  { axis: "z", sign: -1, label: "DEPTH" },
];

const vertex = (pole: (typeof POLES)[number]): Vec3 => ({
  x: pole.axis === "x" ? pole.sign : 0,
  y: pole.axis === "y" ? pole.sign : 0,
  z: pole.axis === "z" ? pole.sign : 0,
});

const EDGES: [number, number][] = [];
for (let i = 0; i < POLES.length; i += 1) {
  for (let j = i + 1; j < POLES.length; j += 1) {
    if (POLES[i].axis !== POLES[j].axis) EDGES.push([i, j]);
  }
}

const CAMERA = 3.4;
const SCALE = 0.34;

const rotate = ({ x, y, z }: Vec3, yaw: number, pitch: number): Vec3 => {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const rx = x * cy + z * sy;
  const rz = z * cy - x * sy;
  return { x: rx, y: y * cp - rz * sp, z: rz * cp + y * sp };
};

export function TasteUniverse({ points, size = 320 }: { points: UniversePoint[]; size?: number }) {
  const router = useRouter();
  const center = size / 2;
  const [yaw, setYaw] = useState(0.6);
  const [pitch, setPitch] = useState(0.32);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const travelled = useRef(0);

  useEffect(() => {
    if (dragging) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      setYaw((current) => current + dt * 0.00012);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);

  const place = (v: Vec3) => {
    const r = rotate(v, yaw, pitch);
    const depth = CAMERA / (CAMERA - r.z);
    return {
      x: center + r.x * size * SCALE * depth,
      y: center - r.y * size * SCALE * depth,
      z: r.z,
      depth,
    };
  };

  const hull = POLES.map((pole) => place(vertex(pole)));

  const plotted = points
    .map((point) => ({ point, at: place(project3(point.vector)) }))
    .sort((a, b) => a.at.z - b.at.z);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Taste Universe (3D feature space)"
      style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, y: event.clientY };
        travelled.current = 0;
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        drag.current = { x: event.clientX, y: event.clientY };
        travelled.current += Math.abs(dx) + Math.abs(dy);
        // Capture only once it is a real drag, so a plain tap still reaches the point.
        if (travelled.current > 6 && !event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setYaw((current) => current + dx * 0.008);
        setPitch((current) => Math.max(-1.2, Math.min(1.2, current + dy * 0.008)));
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerLeave={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
    >
      <rect x={0} y={0} width={size} height={size} fill="var(--surface)" stroke="var(--line)" />

      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={hull[a].x}
          y1={hull[a].y}
          x2={hull[b].x}
          y2={hull[b].y}
          stroke="rgba(236,233,228,0.12)"
          strokeWidth={0.8}
        />
      ))}

      {POLES.map((pole, i) => (
        <text
          key={pole.label}
          x={hull[i].x}
          y={hull[i].y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={7.5}
          letterSpacing={1.2}
          fill="rgba(236,233,228,0.4)"
          opacity={0.35 + hull[i].depth * 0.4}
        >
          {pole.label}
        </text>
      ))}

      {plotted.map(({ point, at }) => {
        const r = (point.watched ? 2.6 + (point.rating ?? 3) * 0.7 : 2.8) * at.depth;
        return (
          <g
            key={point.id}
            role="link"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (travelled.current > 6) return;
              router.push(`/movie/${point.providerId}`);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") router.push(`/movie/${point.providerId}`);
            }}
            aria-label={point.title}
          >
            <circle
              cx={at.x}
              cy={at.y}
              r={r}
              fill={point.watched ? "var(--accent)" : "transparent"}
              fillOpacity={point.watched ? 0.3 + at.depth * 0.45 : 0}
              stroke={point.watched ? "var(--accent)" : "rgba(236,233,228,0.5)"}
              strokeWidth={0.9}
              strokeOpacity={0.35 + at.depth * 0.45}
            />
            <title>{point.title}</title>
          </g>
        );
      })}

      <text x={12} y={size - 8} fontSize={8} letterSpacing={1.4} fill="var(--muted)">
        ● WATCHED　○ RECOMMENDED　/　DRAG TO ROTATE
      </text>
    </svg>
  );
}
