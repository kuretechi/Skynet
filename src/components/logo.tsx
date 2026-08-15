const PERFORATIONS = [0, 1, 2, 3].map((i) => 124 + i * 72);

/**
 * A film frame holding the Cinema Crystal: the medium on the outside, the
 * taste it condenses into on the inside. Inherits colour from `currentColor`.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden focusable="false">
      <rect x="106" y="86" width="300" height="340" rx="30" fill="none" stroke="currentColor" strokeWidth={14} />
      {PERFORATIONS.map((y) => (
        <g key={y} fill="currentColor" opacity={0.5}>
          <rect x="132" y={y} width="20" height="26" rx="6" />
          <rect x="360" y={y} width="20" height="26" rx="6" />
        </g>
      ))}
      <g fill="none" stroke="currentColor" strokeWidth={13} strokeLinejoin="round" strokeLinecap="round">
        <polygon points="256,152 330,256 256,360 182,256" />
        <path d="M182 256 L330 256 M256 152 L256 360" />
      </g>
    </svg>
  );
}

export function Logo({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark size={size} className="text-[var(--accent)]" />
      <span className="flex flex-col gap-1 leading-none">
        <span className="display text-sm tracking-[0.22em]">PERSONAL</span>
        <span className="label text-[10px] text-[var(--muted)]">CINEMA</span>
      </span>
    </span>
  );
}
