import Link from "next/link";
import type { ScoredMovie } from "@/lib/recommend/engine";
import { posterUrl } from "@/lib/movies/repository";
import { PosterFrame, releaseYear } from "./movie-visuals";

export function SectionHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
      <h2 className="label">{title}</h2>
      {caption ? <span className="text-[10px] text-[var(--muted)]">{caption}</span> : null}
    </div>
  );
}

export function ScoredMovieRow({ item }: { item: ScoredMovie }) {
  const { movie, score } = item;
  return (
    <Link href={`/movie/${movie.providerId}`} className="flex items-center gap-4 py-3">
      <PosterFrame
        title={movie.title}
        posterUrl={posterUrl(movie)}
        year={releaseYear(movie.releaseDate)}
        className="w-14 shrink-0"
        sizes="56px"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{movie.title}</p>
        <p className="label mt-1">{releaseYear(movie.releaseDate)}{movie.director ? ` · ${movie.director}` : ""}</p>
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">{item.explanation}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="label">For You</span>
        <span className="display text-xl text-[var(--accent)]">{score.predicted.toFixed(1)}</span>
        <span className="font-mono text-[10px] text-[var(--muted)]">{score.match}% MATCH</span>
        <span className="font-mono text-[10px] text-[var(--muted)]">
          CONF {Math.round(score.confidence * 100)}%
        </span>
      </div>
    </Link>
  );
}

export function ScoredMovieCarousel({ items }: { items: ScoredMovie[] }) {
  return (
    <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 py-1">
      {items.map((item) => (
        <li key={item.movie.id} className="w-32 shrink-0">
          <Link href={`/movie/${item.movie.providerId}`}>
            <PosterFrame
              title={item.movie.title}
              posterUrl={posterUrl(item.movie)}
              year={releaseYear(item.movie.releaseDate)}
              className="w-32"
              sizes="128px"
            />
            <p className="mt-2 truncate text-xs">{item.movie.title}</p>
            <p className="font-mono text-[10px] text-[var(--accent)]">{item.score.match}% MATCH</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
