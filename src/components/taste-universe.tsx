"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AXES, AXIS_LABELS, type Axis, type AxisVector } from "@/lib/dna/axes";

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
 * Taste Universe. One point = one movie inside the octahedral hull of the
 * 8-axis DNA: the solid has exactly eight faces, so every axis owns one of
 * them and pulls a movie towards its face centre. Opposite faces carry
 * opposing tastes (THINK/FEEL, SENSE/STORY, PULSE/DEPTH, EXPLORE/IMMERSE).
 */
const SPREAD = 2.6;

const FACE_SIGNS: Record<Axis, [1 | -1, 1 | -1, 1 | -1]> = {
  think: [1, 1, 1],
  feel: [-1, -1, -1],
  sense: [-1, 1, 1],
  story: [1, -1, -1],
  pulse: [1, -1, 1],
  depth: [-1, 1, -1],
  explore: [1, 1, -1],
  immerse: [-1, -1, 1],
};

// Centre of the octahedron face living in that octant: |x| + |y| + |z| = 1.
const faceCentre = (axis: Axis): Vec3 => {
  const [sx, sy, sz] = FACE_SIGNS[axis];
  return { x: sx / 3, y: sy / 3, z: sz / 3 };
};

// Labels float just outside their own face so they read as face names
// rather than as another cluster of points near the centre.
const LABEL_LIFT = 1.7;

const FACES = AXES.map((axis) => {
  const centre = faceCentre(axis);
  return {
    label: AXIS_LABELS[axis].label,
    at: { x: centre.x * LABEL_LIFT, y: centre.y * LABEL_LIFT, z: centre.z * LABEL_LIFT },
  };
});

/**
 * Each face pulls the movie by how far its axis stands out from the movie's
 * own average — absolute intensity would bunch every title around the origin,
 * where what distinguishes them is their profile, not their loudness. The
 * result is scaled by SPREAD and capped on the hull (|x| + |y| + |z| = 1), so
 * a point can touch its face but never pierce it.
 */
const project3 = (v: AxisVector): Vec3 => {
  const average = AXES.reduce((sum, axis) => sum + v[axis], 0) / AXES.length;
  let weight = 0;
  const pull: Vec3 = { x: 0, y: 0, z: 0 };
  for (const axis of AXES) {
    const deviation = v[axis] - average;
    const centre = faceCentre(axis);
    weight += Math.abs(deviation);
    pull.x += deviation * centre.x;
    pull.y += deviation * centre.y;
    pull.z += deviation * centre.z;
  }
  if (weight === 0) return { x: 0, y: 0, z: 0 };
  const mean = { x: pull.x / weight, y: pull.y / weight, z: pull.z / weight };
  const reach = Math.abs(mean.x) + Math.abs(mean.y) + Math.abs(mean.z);
  const scale = reach * SPREAD > 1 ? 1 / reach : SPREAD;
  return { x: mean.x * scale, y: mean.y * scale, z: mean.z * scale };
};

const CORNERS: Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

const EDGES: [number, number][] = [];
for (let i = 0; i < CORNERS.length; i += 1) {
  for (let j = i + 1; j < CORNERS.length; j += 1) {
    // Every pair but the two poles of the same axis is an edge.
    if (CORNERS[i].x + CORNERS[j].x !== 0 || CORNERS[i].y + CORNERS[j].y !== 0 || CORNERS[i].z + CORNERS[j].z !== 0)
      EDGES.push([i, j]);
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

const AUTO_SPIN = 0.00012;
const DRAG_SENSITIVITY = 0.008;
const FRICTION = 0.9;

export function TasteUniverse({ points, size = 320 }: { points: UniversePoint[]; size?: number }) {
  const router = useRouter();
  const center = size / 2;
  const [{ yaw, pitch }, setAngles] = useState({ yaw: 0.6, pitch: 0.32 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const travelled = useRef(0);
  const angles = useRef({ yaw: 0.6, pitch: 0.32 });
  const pending = useRef({ yaw: 0, pitch: 0 });
  const velocity = useRef({ yaw: 0, pitch: 0 });
  const held = useRef(false);

  // One rAF loop owns the rotation: pointer deltas are accumulated in refs and
  // flushed once per frame, so a burst of pointermove events cannot stutter the
  // render. Releasing keeps the last velocity and lets it decay into the
  // idle spin.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      const dragged = pending.current;
      pending.current = { yaw: 0, pitch: 0 };

      if (held.current) {
        velocity.current = { yaw: dragged.yaw / dt, pitch: dragged.pitch / dt };
      } else {
        velocity.current = {
          yaw: velocity.current.yaw * FRICTION,
          pitch: velocity.current.pitch * FRICTION,
        };
      }

      const idle = held.current || reduced ? 0 : AUTO_SPIN * dt;
      const next = {
        yaw: angles.current.yaw + dragged.yaw + (held.current ? 0 : velocity.current.yaw * dt) + idle,
        pitch: Math.max(
          -1.2,
          Math.min(
            1.2,
            angles.current.pitch + dragged.pitch + (held.current ? 0 : velocity.current.pitch * dt),
          ),
        ),
      };

      if (next.yaw !== angles.current.yaw || next.pitch !== angles.current.pitch) {
        angles.current = next;
        setAngles(next);
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

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

  const hull = CORNERS.map(place);
  const faces = FACES.map((face) => ({ ...face, at: place(face.at) }));

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
        velocity.current = { yaw: 0, pitch: 0 };
        held.current = true;
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
        pending.current = {
          yaw: pending.current.yaw + dx * DRAG_SENSITIVITY,
          pitch: pending.current.pitch + dy * DRAG_SENSITIVITY,
        };
      }}
      onPointerUp={() => {
        drag.current = null;
        held.current = false;
        setDragging(false);
      }}
      onPointerLeave={() => {
        drag.current = null;
        held.current = false;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        held.current = false;
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
          stroke="var(--ink-12)"
          strokeWidth={0.8}
        />
      ))}

      {faces.map((face) => (
        <text
          key={face.label}
          x={face.at.x}
          y={face.at.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={7.5}
          letterSpacing={1.2}
          fill="var(--ink-40)"
          opacity={face.at.z > 0 ? 0.3 + face.at.depth * 0.45 : 0.18}
        >
          {face.label}
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
              stroke={point.watched ? "var(--accent)" : "var(--ink-55)"}
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
