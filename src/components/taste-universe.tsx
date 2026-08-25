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
  masterpiece?: boolean;
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
const DRAG_SENSITIVITY = 0.009;
const FRICTION = 0.9;
const PITCH_LIMIT = 1.2;
// Release velocity is read over this window instead of the last frame, so a
// steady drag does not fling the hull just because the final frame was long.
const FLING_WINDOW = 90;
const FLING_MAX = 0.012;
const MASTERPIECE_COLOR = "var(--masterpiece)";

/** Keep dense universes readable without abruptly changing size at a threshold. */
const pointScaleForCount = (count: number) =>
  Math.max(0.48, Math.min(1, Math.sqrt(36 / Math.max(count, 36))));

/** Five-pointed star polygon, used to mark masterpieces. */
const starPoints = (cx: number, cy: number, outer: number) => {
  const inner = outer * 0.42;
  const coords: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    coords.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return coords.join(" ");
};

const clampPitch = (pitch: number) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
const clampFling = (v: number) => Math.max(-FLING_MAX, Math.min(FLING_MAX, v));

export function TasteUniverse({
  points,
  size = 320,
  /** Off for the signed-out demo, where the movie pages would bounce to login. */
  linkMovies = true,
}: {
  points: UniversePoint[];
  size?: number;
  linkMovies?: boolean;
}) {
  const router = useRouter();
  const open = (providerId: string) => {
    if (linkMovies) router.push(`/movie/${providerId}`);
  };
  const center = size / 2;
  const [{ yaw, pitch }, setAngles] = useState({ yaw: 0.6, pitch: 0.32 });
  const [dragging, setDragging] = useState(false);
  const travelled = useRef(0);
  const angles = useRef({ yaw: 0.6, pitch: 0.32 });
  const velocity = useRef({ yaw: 0, pitch: 0 });
  const grab = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const trail = useRef<{ t: number; x: number; y: number }[]>([]);

  // The hull is pinned to the pointer: while held, the angles are recomputed
  // from the absolute distance travelled since pointerdown, so a dropped frame
  // can never leave the rotation behind the cursor. Releasing hands over to the
  // velocity measured across FLING_WINDOW, which decays into the idle spin.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      let next: { yaw: number; pitch: number };
      const held = grab.current;
      if (held) {
        next = {
          yaw: held.yaw + (pointer.current.x - held.x) * DRAG_SENSITIVITY,
          pitch: clampPitch(held.pitch + (pointer.current.y - held.y) * DRAG_SENSITIVITY),
        };
      } else {
        velocity.current = {
          yaw: velocity.current.yaw * FRICTION,
          pitch: velocity.current.pitch * FRICTION,
        };
        next = {
          yaw: angles.current.yaw + velocity.current.yaw * dt + (reduced ? 0 : AUTO_SPIN * dt),
          pitch: clampPitch(angles.current.pitch + velocity.current.pitch * dt),
        };
      }

      if (next.yaw !== angles.current.yaw || next.pitch !== angles.current.pitch) {
        angles.current = next;
        setAngles(next);
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const release = () => {
    if (!grab.current) return;
    const now = performance.now();
    const recent = trail.current.filter((sample) => now - sample.t <= FLING_WINDOW);
    const first = recent[0];
    const span = first ? now - first.t : 0;
    velocity.current =
      first && span > 16
        ? {
            yaw: clampFling(((pointer.current.x - first.x) * DRAG_SENSITIVITY) / span),
            pitch: clampFling(((pointer.current.y - first.y) * DRAG_SENSITIVITY) / span),
          }
        : { yaw: 0, pitch: 0 };
    grab.current = null;
    trail.current = [];
    setDragging(false);
  };

  const releaseRef = useRef(release);
  releaseRef.current = release;

  // A release outside the svg before the pointer was captured would otherwise
  // leave the hull stuck to a pointer that is no longer down.
  useEffect(() => {
    const end = () => releaseRef.current();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
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
  const pointScale = pointScaleForCount(points.length);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Taste Universe (3D feature space)"
      className="taste-universe"
      style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={(event) => {
        grab.current = {
          x: event.clientX,
          y: event.clientY,
          yaw: angles.current.yaw,
          pitch: angles.current.pitch,
        };
        pointer.current = { x: event.clientX, y: event.clientY };
        trail.current = [{ t: performance.now(), x: event.clientX, y: event.clientY }];
        travelled.current = 0;
        velocity.current = { yaw: 0, pitch: 0 };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!grab.current) return;
        travelled.current +=
          Math.abs(event.clientX - pointer.current.x) + Math.abs(event.clientY - pointer.current.y);
        pointer.current = { x: event.clientX, y: event.clientY };
        const now = performance.now();
        trail.current.push({ t: now, x: event.clientX, y: event.clientY });
        while (trail.current.length > 2 && now - trail.current[0].t > FLING_WINDOW) trail.current.shift();
        // A touch pointer is implicitly captured by whatever it landed on; taking
        // the capture would fire lostpointercapture there, which bubbles up here
        // and used to end the drag one move in. The implicit capture already
        // keeps the moves coming, so only mouse/pen needs an explicit capture,
        // and only past 6px so that a plain tap still reaches the point.
        if (
          event.pointerType !== "touch" &&
          travelled.current > 6 &&
          !event.currentTarget.hasPointerCapture(event.pointerId)
        ) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
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
        const r =
          (point.watched ? 2.6 + (point.rating ?? 3) * 0.7 : 2.8) * at.depth * pointScale;
        // Masterpieces are drawn as a haloed star instead of a dot, so the films
        // that define the taste read at a glance.
        const star = point.masterpiece ? starPoints(at.x, at.y, r * 1.9) : null;
        return (
          <g
            key={point.id}
            role={linkMovies ? "link" : "img"}
            tabIndex={linkMovies ? 0 : -1}
            style={{ cursor: linkMovies ? "pointer" : "inherit" }}
            onClick={() => {
              if (travelled.current > 6) return;
              open(point.providerId);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") open(point.providerId);
            }}
            aria-label={point.title}
          >
            {star ? (
              <>
                <circle
                  className="masterpiece-ripple"
                  cx={at.x}
                  cy={at.y}
                  r={r * 1.5}
                  fill="none"
                  stroke={MASTERPIECE_COLOR}
                  strokeWidth={0.9}
                />
                <circle
                  className="masterpiece-ripple masterpiece-ripple-delayed"
                  cx={at.x}
                  cy={at.y}
                  r={r * 1.5}
                  fill="none"
                  stroke={MASTERPIECE_COLOR}
                  strokeWidth={0.7}
                />
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={r * 2.6}
                  fill={MASTERPIECE_COLOR}
                  fillOpacity={0.08 + at.depth * 0.08}
                />
                <polygon
                  points={star}
                  fill={MASTERPIECE_COLOR}
                  fillOpacity={0.6 + at.depth * 0.3}
                  stroke={MASTERPIECE_COLOR}
                  strokeWidth={1.1}
                  strokeLinejoin="round"
                />
              </>
            ) : (
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
            )}
            <title>{point.title}</title>
          </g>
        );
      })}

      <text x={12} y={size - 8} fontSize={8} letterSpacing={1.4} fill="var(--muted)">
        ○ RECOMMENDED　● WATCHED　
        <tspan fill={MASTERPIECE_COLOR}>★ MASTERPIECE</tspan>
      </text>
    </svg>
  );
}
