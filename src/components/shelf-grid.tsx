import Image from "next/image";
import Link from "next/link";
import type { ShelfItem } from "@/components/shelf-rack";
import { spineColor } from "@/components/movie-visuals";

/** Catalogue view of a shelf: posters at full colour with a filing caption. */
export function ShelfGrid({ items }: { items: ShelfItem[] }) {
  return (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-5">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/movie/${item.providerId}`} className="block">
            <div
              className="relative aspect-[2/3] overflow-hidden rounded-[2px]"
              style={{
                background: spineColor(item.title),
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1), 0 12px 18px -14px rgba(0,0,0,0.9)",
              }}
            >
              {item.posterUrl ? (
                <Image src={item.posterUrl} alt="" fill sizes="120px" className="object-cover" />
              ) : (
                <span className="display absolute inset-0 flex items-end p-2 text-[11px] leading-tight text-[var(--on-media)]">
                  {item.title}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="label">{item.year?.slice(2) ? `'${item.year.slice(2)}` : "—"}</span>
              <span className="font-mono text-[10px] text-[var(--accent)]">
                {item.rating ? item.rating.toFixed(1) : "·"}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--muted)]">{item.title}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
