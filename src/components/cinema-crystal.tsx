import { AXES, AXIS_LABELS, type AxisVector } from "@/lib/dna/axes";

/**
 * Cinema Crystal — the identity object. An 8-axis radial polyhedron rendered as
 * lightweight SVG so it stays smooth on mobile (no WebGL dependency).
 */
export function CinemaCrystal({
  vector,
  size = 260,
  accent = "#d8a657",
  showLabels = true,
}: {
  vector: AxisVector;
  size?: number;
  accent?: string;
  showLabels?: boolean;
}) {
  const center = size / 2;
  const radius = size * (showLabels ? 0.32 : 0.42);

  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
    const r = radius * (0.28 + value * 0.72);
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const;
  };

  const points = AXES.map((axis, i) => point(i, vector[axis]));
  const polygon = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Cinema Crystal">
      <defs>
        <radialGradient id="crystal-fill" cx="50%" cy="45%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.42" />
          <stop offset="70%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.03" />
        </radialGradient>
      </defs>

      <g>
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <polygon
            key={ring}
            points={AXES.map((_, i) => {
              const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
              const r = radius * ring;
              return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(236,233,228,0.08)"
          />
        ))}
        <polygon points={polygon} fill="url(#crystal-fill)" stroke={accent} strokeWidth={1.2} />
        {points.map(([x, y], i) => (
          <g key={AXES[i]}>
            <line x1={center} y1={center} x2={x} y2={y} stroke={accent} strokeOpacity={0.25} />
            <circle cx={x} cy={y} r={2.4} fill={accent} />
          </g>
        ))}
      </g>

      {showLabels
        ? AXES.map((axis, i) => {
            const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
            const r = radius * 1.34;
            const cos = Math.cos(angle);
            const x = center + cos * r;
            const y = center + Math.sin(angle) * r;
            // Anchor side labels inwards so long axis names stay inside the viewBox.
            const anchor = cos > 0.3 ? "end" : cos < -0.3 ? "start" : "middle";
            return (
              <text
                key={axis}
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={9}
                letterSpacing={1.6}
                fill="rgba(236,233,228,0.55)"
              >
                {AXIS_LABELS[axis].label}
              </text>
            );
          })
        : null}
    </svg>
  );
}

export function DnaBars({ vector }: { vector: AxisVector }) {
  return (
    <ul className="flex flex-col gap-3">
      {AXES.map((axis) => (
        <li key={axis} className="flex items-center gap-3">
          <span className="label w-16 shrink-0">{AXIS_LABELS[axis].label}</span>
          <span className="relative h-[3px] flex-1 bg-[var(--line)]">
            <span
              className="absolute inset-y-0 left-0 bg-[var(--accent)]"
              style={{ width: `${Math.round(vector[axis] * 100)}%` }}
            />
          </span>
          <span className="w-8 text-right font-mono text-[10px] text-[var(--muted)]">
            {Math.round(vector[axis] * 100)}
          </span>
        </li>
      ))}
    </ul>
  );
}
