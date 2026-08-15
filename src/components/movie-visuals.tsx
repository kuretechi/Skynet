import Image from "next/image";
import Link from "next/link";

const PALETTE = ["#2a2f3a", "#33262a", "#232f2b", "#2f2a38", "#382f26", "#26313a", "#3a2f2f", "#2b3326"];

const hash = (value: string) => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) % 100000;
  return h;
};

export const spineColor = (seed: string) => PALETTE[hash(seed) % PALETTE.length];

export const releaseYear = (releaseDate?: string | null) => releaseDate?.slice(0, 4) ?? "----";

/** Poster if the provider supplies one, otherwise a typographic archive card. */
export function PosterFrame({
  title,
  posterUrl,
  year,
  className = "",
  sizes = "160px",
}: {
  title: string;
  posterUrl: string | null;
  year?: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2px] border border-[var(--line)] bg-[var(--surface-2)] ${className}`}
      style={{ aspectRatio: "2 / 3" }}
    >
      {posterUrl ? (
        <Image src={posterUrl} alt={title} fill sizes={sizes} className="object-cover" />
      ) : (
        <div
          className="spine-texture flex h-full w-full flex-col justify-between p-3"
          style={{ background: spineColor(title) }}
        >
          <span className="label" style={{ color: "rgba(236,233,228,0.55)" }}>
            {year ?? ""}
          </span>
          <span className="display text-sm leading-tight text-[var(--foreground)]">{title}</span>
        </div>
      )}
    </div>
  );
}

/** VHS-style spine used on the Shelf: the collection reads as physical media. */
export function MovieSpine({
  title,
  providerId,
  year,
  rating,
}: {
  title: string;
  providerId: string;
  year?: string;
  rating?: number | null;
}) {
  return (
    <Link
      href={`/movie/${providerId}`}
      className="spine-texture group relative flex h-56 w-[44px] shrink-0 flex-col items-center justify-between rounded-[2px] border border-[var(--line)] py-3 transition-transform duration-200 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
      style={{ background: spineColor(title) }}
    >
      <span className="label" style={{ color: "rgba(236,233,228,0.5)", letterSpacing: "0.1em" }}>
        {year?.slice(2) ?? ""}
      </span>
      <span className="vertical-text max-h-40 overflow-hidden text-[11px] tracking-wide text-[var(--foreground)]">
        {title}
      </span>
      <span className="text-[10px] text-[var(--accent-soft)]">{rating ? rating.toFixed(1) : "·"}</span>
    </Link>
  );
}

export function ScoreBlock({
  label,
  value,
  suffix,
  strong = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span
        className={strong ? "display text-4xl text-[var(--accent)]" : "display text-2xl text-[var(--foreground)]"}
      >
        {value}
        {suffix ? <span className="ml-1 text-xs text-[var(--muted)]">{suffix}</span> : null}
      </span>
    </div>
  );
}
