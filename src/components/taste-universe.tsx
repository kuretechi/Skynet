import type { AxisVector } from "@/lib/dna/axes";

export type UniversePoint = {
  id: string;
  title: string;
  providerId: string;
  vector: AxisVector;
  rating: number | null;
  watched: boolean;
};

/**
 * Taste Universe (2D projection). One point = one movie; nearby points share
 * feature structure. Fixed deterministic projection keeps the map stable
 * between visits and cheap enough for mobile.
 */
const project = (v: AxisVector) => ({
  x: 0.5 + ((v.explore + v.think + v.depth) / 3 - (v.pulse + v.feel) / 2) * 0.95,
  y: 0.5 - ((v.sense + v.immerse) / 2 - (v.story + v.feel) / 2) * 0.95,
});

export function TasteUniverse({ points, size = 320 }: { points: UniversePoint[]; size?: number }) {
  const padding = 18;
  const span = size - padding * 2;

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Taste Universe">
      <rect x={0} y={0} width={size} height={size} fill="var(--surface)" stroke="var(--line)" />
      {[0.25, 0.5, 0.75].map((g) => (
        <g key={g} stroke="rgba(236,233,228,0.05)">
          <line x1={padding + span * g} y1={padding} x2={padding + span * g} y2={padding + span} />
          <line x1={padding} y1={padding + span * g} x2={padding + span} y2={padding + span * g} />
        </g>
      ))}

      {points.map((point) => {
        const { x, y } = project(point.vector);
        const cx = padding + Math.min(1, Math.max(0, x)) * span;
        const cy = padding + Math.min(1, Math.max(0, y)) * span;
        const r = point.watched ? 3 + (point.rating ?? 3) * 0.9 : 3.2;
        return (
          <a key={point.id} href={`/movie/${point.providerId}`} aria-label={point.title}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={point.watched ? "var(--accent)" : "transparent"}
              fillOpacity={point.watched ? 0.85 : 0}
              stroke={point.watched ? "var(--accent)" : "rgba(236,233,228,0.5)"}
              strokeWidth={1}
            />
            <title>{point.title}</title>
          </a>
        );
      })}

      <text x={padding} y={size - 6} fontSize={8} letterSpacing={1.4} fill="var(--muted)">
        ● WATCHED　○ RECOMMENDED
      </text>
    </svg>
  );
}
