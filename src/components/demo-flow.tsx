"use client";

import { useMemo, useState } from "react";
import type { AxisVector } from "@/lib/dna/axes";
import { AXIS_LABELS } from "@/lib/dna/axes";
import { rankCineTypes, topAxes } from "@/lib/dna/cinetype";
import { cineCode } from "@/lib/dna/code";
import { dnaFromSignals } from "@/lib/dna/derive";
import { typeInk } from "@/lib/theme";
import { CinemaCrystal, DnaBars } from "./cinema-crystal";
import { PosterFrame } from "./movie-visuals";
import { TasteUniverse, type UniversePoint } from "./taste-universe";
import { TypeCode, TypeCodeMeters } from "./type-code";

function DemoSectionHeader({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
      <h2 className="label">{title}</h2>
      <span className="text-[10px] text-[var(--muted)]">{caption}</span>
    </div>
  );
}

export type DemoMovie = {
  id: string;
  providerId: string;
  title: string;
  year: string;
  director: string | null;
  posterUrl: string | null;
  vector: AxisVector;
};

/** Picking a movie in the demo means "I love this", the strongest positive signal. */
const DEMO_SCORE = 5;
const MIN_PICKS = 2;
const GRID_SIZE = 24;

export function DemoFlow({ movies }: { movies: DemoMovie[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [revealed, setRevealed] = useState(false);

  const pickedSet = new Set(picked);
  const shortlist = query.trim()
    ? movies.filter((movie) => movie.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, GRID_SIZE)
    : movies.slice(0, GRID_SIZE);
  // Picks made before a search stay visible so they can be undone.
  const grid = [
    ...movies.filter((movie) => pickedSet.has(movie.id) && !shortlist.some((s) => s.id === movie.id)),
    ...shortlist,
  ];

  const dna = useMemo(
    () =>
      dnaFromSignals(
        movies.filter((movie) => pickedSet.has(movie.id)).map((movie) => ({ vector: movie.vector, score: DEMO_SCORE })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movies, picked],
  );

  const ranked = rankCineTypes(dna.vector);
  const primary = ranked[0].type;
  const accent = typeInk(primary.accent);
  const strongest = topAxes(dna.vector, 3);
  const { code } = cineCode(dna.vector);

  const points: UniversePoint[] = movies.map((movie) => ({
    id: movie.id,
    title: movie.title,
    providerId: movie.providerId,
    vector: movie.vector,
    rating: pickedSet.has(movie.id) ? DEMO_SCORE : null,
    watched: pickedSet.has(movie.id),
  }));

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  if (revealed) {
    return (
      <div className="reveal flex flex-col gap-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <span className="label">Your Type Code</span>
          <CinemaCrystal vector={dna.vector} size={280} accent={primary.accent} />
          <TypeCode vector={dna.vector} accent={accent} />
          <h2 className="sr-only">
            {code} {primary.name}
          </h2>
          <p className="label">{primary.name}</p>
          <p className="text-sm text-[var(--muted)]">{primary.tagline}</p>
          <p className="max-w-md text-sm leading-relaxed">{primary.description}</p>
          <p className="font-mono text-[11px] text-[var(--muted)]">
            {picked.length} PICKS · DEMO PROFILE
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <DemoSectionHeader title="Type Code" caption="8軸を4つの対で読む / 中央に近いほど拮抗" />
          <TypeCodeMeters vector={dna.vector} accent={accent} />
        </section>

        <section className="flex flex-col gap-4">
          <DemoSectionHeader title="8 Axes" caption={strongest.map((axis) => AXIS_LABELS[axis].label).join(" / ")} />
          <DnaBars vector={dna.vector} />
        </section>

        <section className="flex flex-col gap-4">
          <DemoSectionHeader title="Nearby Types" caption="境界にいるタイプ" />
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {ranked.slice(1, 3).map((match) => (
              <li key={match.type.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm" style={{ color: typeInk(match.type.accent) }}>
                    {match.type.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{match.type.tagline}</p>
                </div>
                <span className="font-mono text-xs text-[var(--muted)]">
                  {(match.similarity * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <DemoSectionHeader title="Taste Universe" caption="8軸=8面の3D特徴空間 / 選んだ作品＝実点 / ドラッグで回転" />
          <TasteUniverse points={points} linkMovies={false} />
        </section>

        <button type="button" onClick={() => setRevealed(false)} className="label border border-[var(--line)] px-4 py-4">
          PICK AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <span className="label">Pick your favourites</span>
        <span className="font-mono text-xs text-[var(--muted)]">{picked.length} SELECTED</span>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="作品名で絞り込む"
        className="w-full border border-[var(--line)] bg-transparent px-3 py-3 text-sm outline-none focus:border-[var(--accent)]"
      />

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {grid.map((movie) => {
          const selected = pickedSet.has(movie.id);
          return (
            <li key={movie.id}>
              <button
                type="button"
                onClick={() => toggle(movie.id)}
                aria-pressed={selected}
                className="flex w-full flex-col text-left"
              >
                <span
                  className="block transition-opacity"
                  style={{
                    outline: selected ? "2px solid var(--accent)" : "none",
                    outlineOffset: 2,
                    opacity: selected ? 1 : 0.75,
                  }}
                >
                  <PosterFrame title={movie.title} posterUrl={movie.posterUrl} year={movie.year} sizes="140px" />
                </span>
                <span className="mt-2 truncate text-xs" style={{ color: selected ? "var(--accent)" : undefined }}>
                  {movie.title}
                </span>
                <span className="label mt-0.5 truncate">{movie.year}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        disabled={picked.length < MIN_PICKS}
        className="label sticky bottom-6 border border-[var(--accent)] bg-[var(--background)] px-4 py-4 text-[var(--accent)] disabled:opacity-40"
      >
        {picked.length < MIN_PICKS ? `あと ${MIN_PICKS - picked.length} 本選んでください` : "SHOW MY CINETYPE"}
      </button>
    </div>
  );
}
