"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { spineColor } from "@/components/movie-visuals";

export type ShelfItem = {
  id: string;
  title: string;
  providerId: string;
  year?: string;
  rating?: number | null;
  posterUrl: string | null;
};

const SPINE_WIDTH = 46;
const CASE_HEIGHT = 224;
const COVER_WIDTH = 132;
const MAX_TILT = 46;
const MAX_LIFT = 38;
const PUSH = 52;
const FOCUS_WINDOW = 0.32;
const GAP = 3;
const SLOT = SPINE_WIDTH + GAP;
const RACK_PADDING = 20;

/**
 * VHS rack. Each item is a real 3D case — spine facing the room, cover hinged
 * on the spine's outer edge — and the tilt is driven by the rack's scroll
 * position, so covers open towards the middle of the viewport as you scroll.
 */
export function ShelfRack({ items }: { items: ShelfItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const cases = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    let frame = 0;

    const apply = () => {
      frame = 0;
      const width = el.clientWidth;
      const content = SLOT * items.length;
      if (width === 0 || content === 0) return;

      // Racks wide enough to scroll follow their own viewport centre; short
      // racks follow the page instead, so the tilt still travels with scroll.
      let focus: number;
      if (content > width) {
        focus = (el.scrollLeft + width / 2 - RACK_PADDING) / content;
      } else {
        const rect = el.getBoundingClientRect();
        focus = 1 - (rect.top + rect.height / 2) / window.innerHeight;
      }
      focus = Math.max(0, Math.min(1, focus));

      const openness = cases.current.map((_, index) => {
        const u = ((index + 0.5) * SLOT) / content;
        return Math.max(0, 1 - Math.abs(u - focus) / FOCUS_WINDOW);
      });
      const total = openness.reduce((sum, value) => sum + value, 0);

      // Opened cases need room for their cover, so the rack parts around them:
      // each case is pushed by however far its neighbours have swung open.
      let before = 0;
      cases.current.forEach((node, index) => {
        const open = openness[index];
        if (node) {
          const after = total - before - open;
          const shift = PUSH * (before - after) * 0.5;
          node.style.transform =
            `translateX(${shift}px) translateZ(${MAX_LIFT * open}px) rotateY(${-MAX_TILT * open}deg)`;
          node.style.zIndex = String(Math.round(open * 100));
        }
        before += open;
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items.length]);

  return (
    <div ref={scroller} className="no-scrollbar -mx-5 overflow-x-auto px-5">
      <ul
        className="flex items-end gap-[3px] border-b border-[var(--line)] pb-3"
        style={{ perspective: "900px", perspectiveOrigin: "50% 40%" }}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            ref={(node) => {
              cases.current[index] = node;
            }}
            className="relative shrink-0"
            style={{
              width: SPINE_WIDTH,
              height: CASE_HEIGHT,
              transformStyle: "preserve-3d",
              transformOrigin: "right center",
            }}
          >
            <Link
              href={`/movie/${item.providerId}`}
              aria-label={item.title}
              className="spine-texture absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-[2px] border border-[var(--line)] py-3"
              style={{ background: spineColor(item.title), backfaceVisibility: "hidden" }}
            >
              {item.posterUrl ? (
                <span aria-hidden className="pointer-events-none absolute inset-0">
                  <Image
                    src={item.posterUrl}
                    alt=""
                    fill
                    sizes="46px"
                    className="object-cover"
                    style={{ filter: "blur(5px) saturate(0.7)", opacity: 0.55, transform: "scale(1.3)" }}
                  />
                  <span className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/70" />
                </span>
              ) : null}
              <span
                className="relative label"
                style={{ color: "rgba(236,233,228,0.5)", letterSpacing: "0.1em" }}
              >
                {item.year?.slice(2) ?? ""}
              </span>
              <span className="relative vertical-text max-h-40 overflow-hidden text-[11px] tracking-wide text-[var(--foreground)]">
                {item.title}
              </span>
              <span className="relative text-[10px] text-[var(--accent-soft)]">
                {item.rating ? item.rating.toFixed(1) : "·"}
              </span>
            </Link>

            <div
              aria-hidden
              className="absolute top-0 left-full overflow-hidden rounded-[2px] border border-[var(--line)] bg-[var(--surface-2)]"
              style={{
                width: COVER_WIDTH,
                height: CASE_HEIGHT,
                transformOrigin: "left center",
                transform: "rotateY(90deg)",
                backfaceVisibility: "hidden",
              }}
            >
              {item.posterUrl ? (
                <Image src={item.posterUrl} alt="" fill sizes="150px" className="object-cover" />
              ) : (
                <div
                  className="spine-texture flex h-full w-full flex-col justify-end p-3"
                  style={{ background: spineColor(item.title) }}
                >
                  <span className="display text-sm leading-tight text-[var(--foreground)]">{item.title}</span>
                </div>
              )}
              <span className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
