"use client";

import { useEffect, useRef, useState } from "react";
import { PosterFrame } from "@/components/movie-visuals";

const FADE_DISTANCE = 300;
const BAR_FADE_DISTANCE = 80;
const BAR_HEIGHT = 56;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** Smoothstep: eases in and out, so the fade has no visible start or stop. */
const smooth = (t: number) => t * t * (3 - 2 * t);

export function MovieHero({
  title,
  originalTitle,
  meta,
  genres,
  backdrop,
  posterUrl,
  year,
  score,
}: {
  title: string;
  originalTitle?: string | null;
  meta: string;
  genres: string;
  backdrop: string | null;
  posterUrl: string | null;
  year: string;
  score: string;
}) {
  const headingRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [barOpacity, setBarOpacity] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      setProgress(smooth(clamp01(window.scrollY / FADE_DISTANCE)));
      const heading = headingRef.current;
      const barHeight = barRef.current?.offsetHeight ?? BAR_HEIGHT;
      if (heading) {
        const covered = barHeight - heading.getBoundingClientRect().bottom;
        setBarOpacity(smooth(clamp01(covered / BAR_FADE_DISTANCE)));
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const veil = "linear-gradient(to bottom, rgba(0,0,0,1) 20%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0) 100%)";

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-0 bg-cover bg-center will-change-[opacity,filter,transform]"
        style={{
          ...(backdrop ? { backgroundImage: `url(${backdrop})` } : { background: "var(--surface-2)" }),
          height: "calc(15rem + env(safe-area-inset-top))",
          filter: `blur(${(progress * 18).toFixed(1)}px)`,
          maskImage: veil,
          WebkitMaskImage: veil,
          opacity: (0.62 * (1 - progress)).toFixed(3),
          transform: `translate3d(0, ${(-progress * 28).toFixed(1)}px, 0) scale(${1 + progress * 0.05})`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none"
        style={{ height: "calc(6rem + env(safe-area-inset-top))" }}
      />

      <div
        ref={barRef}
        className="sticky top-0 z-30 -mx-5 border-b border-[var(--line)] bg-[var(--nav-background)] px-5 backdrop-blur-md"
        style={{
          height: `calc(${BAR_HEIGHT}px + env(safe-area-inset-top))`,
          paddingTop: "env(safe-area-inset-top)",
          opacity: barOpacity,
          borderBottomColor: `color-mix(in srgb, var(--line) ${(barOpacity * 100).toFixed(0)}%, transparent)`,
          pointerEvents: barOpacity > 0.6 ? "auto" : "none",
          transform: `translate3d(0, ${(-6 * (1 - barOpacity)).toFixed(1)}px, 0)`,
        }}
      >
        <div className="flex items-center gap-3" style={{ height: BAR_HEIGHT }}>
          <p className="min-w-0 max-w-[60%] shrink-0 truncate text-sm">{title}</p>
          <span className="label min-w-0 flex-1 truncate">{meta}</span>
          <span className="display shrink-0 text-lg text-[var(--accent)]">{score}</span>
        </div>
      </div>

      <section ref={headingRef} className="relative z-10 flex gap-5 pt-6">
        <PosterFrame
          title={title}
          posterUrl={posterUrl}
          year={year}
          className="w-32 shrink-0"
          sizes="128px"
        />
        <div className="flex flex-col gap-2">
          <h1 className="display text-2xl leading-tight">{title}</h1>
          {originalTitle ? <p className="text-xs text-[var(--muted)]">{originalTitle}</p> : null}
          <p className="label">{meta}</p>
          <p className="text-xs text-[var(--muted)]">{genres}</p>
        </div>
      </section>
    </>
  );
}
