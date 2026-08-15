"use client";

import { useEffect, useRef, useState } from "react";
import { PosterFrame } from "@/components/movie-visuals";

const FADE_DISTANCE = 180;
const BAR_HEIGHT = 56;

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
  const [progress, setProgress] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const scrolled = window.scrollY;
      setProgress(Math.min(1, Math.max(0, scrolled / FADE_DISTANCE)));
      const heading = headingRef.current;
      if (heading) setPinned(heading.getBoundingClientRect().bottom < BAR_HEIGHT);
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

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-0 h-56 bg-cover bg-center"
        style={{
          ...(backdrop ? { backgroundImage: `url(${backdrop})` } : { background: "var(--surface-2)" }),
          filter: `blur(${(progress * 14).toFixed(1)}px)`,
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 100%)",
          opacity: (0.6 * (1 - progress)).toFixed(3),
          transform: `translate3d(0, ${(-progress * 40).toFixed(1)}px, 0) scale(${1 + progress * 0.06})`,
        }}
      />
      <div aria-hidden className="pointer-events-none h-24" />

      <div
        className="sticky top-0 z-30 -mx-5 border-b border-[var(--line)] bg-[var(--nav-background)] px-5 backdrop-blur-md transition-opacity duration-200"
        style={{
          opacity: pinned ? 1 : 0,
          pointerEvents: pinned ? "auto" : "none",
          height: BAR_HEIGHT,
        }}
      >
        <div className="flex h-full items-center gap-3">
          <p className="min-w-0 shrink-0 max-w-[60%] truncate text-sm">{title}</p>
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
