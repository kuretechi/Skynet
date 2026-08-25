import Link from "next/link";
import type { ScoredMovie } from "@/lib/recommend/engine";
import { posterUrl } from "@/lib/movies/repository";
import { PosterFrame, releaseYear } from "./movie-visuals";
import { WatchlistButton } from "./watchlist-button";

export function SectionHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--line)] pb-2">
      <h2 className="label">{title}</h2>
      {caption ? <span className="text-[10px] text-[var(--muted)]">{caption}</span> : null}
    </div>
  );
}

export function ScoredMovieRow({ item, inWatchlist = false }: { item: ScoredMovie; inWatchlist?: boolean }) {
  const { movie, score } = item;
  return (
    <div className="flex items-center gap-4 py-3">
      <Link href={`/movie/${movie.providerId}`} prefetch={false} className="flex min-w-0 flex-1 items-center gap-4">
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
      </Link>
      <div className="flex flex-col items-end gap-2">
        <span className="label">For You</span>
        <span className="display text-xl text-[var(--accent)]">{score.predicted.toFixed(1)}</span>
        <span className="font-mono text-[10px] text-[var(--muted)]">{score.match}% MATCH</span>
        <span className="font-mono text-[10px] text-[var(--muted)]">
          CONF {Math.round(score.confidence * 100)}%
        </span>
        <WatchlistButton providerId={movie.providerId} initial={inWatchlist} />
      </div>
    </div>
  );
}

export function ScoredMovieCarousel({
  items,
  watchlist,
}: {
  items: ScoredMovie[];
  watchlist?: Set<string>;
}) {
  return (
    <ul className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 py-1">
      {items.map((item) => (
        <li key={item.movie.id} className="w-32 shrink-0">
          <div className="relative">
            <Link href={`/movie/${item.movie.providerId}`} prefetch={false}>
              <PosterFrame
                title={item.movie.title}
                posterUrl={posterUrl(item.movie)}
                year={releaseYear(item.movie.releaseDate)}
                className="w-32"
                sizes="128px"
              />
            </Link>
            <div className="absolute right-1 top-1">
              <WatchlistButton
                providerId={item.movie.providerId}
                initial={watchlist?.has(item.movie.id) ?? false}
                variant="icon"
              />
            </div>
          </div>
          <Link href={`/movie/${item.movie.providerId}`} prefetch={false}>
            <p className="mt-2 truncate text-xs">{item.movie.title}</p>
            <p className="font-mono text-[10px] text-[var(--accent)]">{item.score.match}% MATCH</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
