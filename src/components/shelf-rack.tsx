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
const MAX_TILT = 42;
const MAX_LIFT = 14;
const MAX_DEPTH = 90;
const MAX_SCALE = 0.14;
const DIM = 0.42;
const GAP = 3;
const SLOT = SPINE_WIDTH + GAP;

/**
 * VHS rack. Each item is a real 3D case — spine facing the room, cover hinged
 * on the spine's outer edge — and only the case nearest the rack's centre
 * swings open, so the focused tape lifts clear of its dimmed neighbours.
 */
export function ShelfRack({ items }: { items: ShelfItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const tail = useRef<HTMLLIElement>(null);
  const cases = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const el = scroller.current;
    const listEl = list.current;
    if (!el || !listEl) return;

    let frame = 0;
    let settle = 0;
    let snapTarget: number | null = null;

    const apply = () => {
      frame = 0;
      const width = el.clientWidth;
      const content = SLOT * items.length;
      if (width === 0 || content === 0) return;

      // Half a viewport of slack lets the first and last tape reach the
      // centre; without it they could never become the focused case. The
      // trailing slack is a real element because Chrome drops a scroll
      // container's end padding from its scrollable overflow.
      const pad = content > width ? Math.max(0, width / 2 - SLOT / 2) : 0;
      listEl.style.paddingLeft = `${pad}px`;
      if (tail.current) tail.current.style.width = `${pad}px`;

      // Scrollable racks follow their own centre; short racks follow the page,
      // so the highlight still travels as you scroll past them.
      const scrollable = content > width;
      let centre: number;
      snapTarget = null;
      if (scrollable) {
        const first =
          el.scrollLeft + listEl.getBoundingClientRect().left - el.getBoundingClientRect().left + pad;
        centre = (el.scrollLeft + width / 2 - first) / SLOT - 0.5;
        const focused = Math.max(0, Math.min(items.length - 1, Math.round(centre)));
        snapTarget = Math.max(
          0,
          Math.min(el.scrollWidth - width, first + (focused + 0.5) * SLOT - width / 2),
        );
      } else {
        const rect = el.getBoundingClientRect();
        const progress = Math.max(
          0,
          Math.min(1, 1 - (rect.top + rect.height / 2) / window.innerHeight),
        );
        // Page-driven racks step between whole cases so two never hang open
        // at once; the transition below animates the hand-off.
        centre = Math.round(progress * (items.length - 1));
      }

      cases.current.forEach((node, index) => {
        if (!node) return;
        const distance = Math.abs(index - centre);
        const open = Math.max(0, 1 - distance);
        node.style.transform =
          `translateY(${-MAX_LIFT * open}px) translateZ(${MAX_DEPTH * open}px)` +
          ` rotateY(${-MAX_TILT * open}deg) scale(${1 + MAX_SCALE * open})`;
        // Dimming lives on the faces: a filter on the case itself would
        // flatten its 3D children.
        node.style.setProperty("--case-dim", String(DIM + (1 - DIM) * open));
        node.style.zIndex = String(Math.max(0, 100 - Math.round(distance * 4)));
        node.style.transition = scrollable ? "" : "transform 260ms ease";
      });
    };

    // CSS scroll-snap measures the cases after their 3D transform, so it
    // fights the tilt; settle the rack on the nearest case ourselves instead.
    const snap = () => {
      settle = 0;
      if (snapTarget === null) return;
      if (Math.abs(el.scrollLeft - snapTarget) < 1) return;
      el.scrollTo({
        left: snapTarget,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onRackScroll = () => {
      schedule();
      window.clearTimeout(settle);
      settle = window.setTimeout(snap, 140);
    };

    apply();
    el.addEventListener("scroll", onRackScroll, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      el.removeEventListener("scroll", onRackScroll);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearTimeout(settle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items.length]);

  return (
    <div
      ref={scroller}
      className="no-scrollbar -mx-5 overflow-x-auto px-5 pt-14 pb-4"
      style={{ perspective: "900px", perspectiveOrigin: "50% 45%" }}
    >
      <ul
        ref={list}
        className="flex items-end border-b border-[var(--line)] pb-3"
        style={{ gap: GAP, transformStyle: "preserve-3d" }}
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
              style={{
                background: spineColor(item.title),
                backfaceVisibility: "hidden",
                filter: "brightness(var(--case-dim, 1))",
              }}
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
                style={{ color: "var(--on-media-soft)", letterSpacing: "0.1em" }}
              >
                {item.year?.slice(2) ?? ""}
              </span>
              <span
                className="relative vertical-text max-h-40 overflow-hidden text-[11px] tracking-wide"
                style={{ color: "var(--on-media)" }}
              >
                {item.title}
              </span>
              <span className="relative text-[10px]" style={{ color: "var(--on-media-soft)" }}>
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
                filter: "brightness(var(--case-dim, 1))",
              }}
            >
              {item.posterUrl ? (
                <Image src={item.posterUrl} alt="" fill sizes="150px" className="object-cover" />
              ) : (
                <div
                  className="spine-texture flex h-full w-full flex-col justify-end p-3"
                  style={{ background: spineColor(item.title) }}
                >
                  <span className="display text-sm leading-tight" style={{ color: "var(--on-media)" }}>
                    {item.title}
                  </span>
                </div>
              )}
              <span className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent" />
            </div>
          </li>
        ))}
        <li ref={tail} aria-hidden className="shrink-0" style={{ height: CASE_HEIGHT }} />
      </ul>
    </div>
  );
}
