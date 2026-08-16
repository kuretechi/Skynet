"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RatingInput } from "./rating-input";
import { WatchlistButton } from "./watchlist-button";

export type SearchResult = {
  providerId: string;
  title: string;
  year: string | null;
  posterUrl: string | null;
  genres: string[];
};

const useSearch = (query: string) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading };
};

/**
 * Search surface. In rating mode each result can be rated inline, which is how
 * onboarding collects the first ratings.
 */
export function MovieSearch({
  mode = "browse",
  ratedIds = [],
  onRated,
  placeholder = "タイトル・監督・キーワードで検索",
}: {
  mode?: "browse" | "rate";
  ratedIds?: string[];
  onRated?: (providerId: string, score: number) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const { results, loading } = useSearch(query);

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border-b border-[var(--line)] bg-transparent pb-3 text-lg outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
      />
      {loading ? <p className="label">SEARCHING…</p> : null}
      <ul className="flex flex-col divide-y divide-[var(--line)]">
        {results.map((movie) => (
          <li key={movie.providerId} className="flex items-center gap-4 py-3">
            <div className="relative h-16 w-11 shrink-0 overflow-hidden border border-[var(--line)] bg-[var(--surface-2)]">
              {movie.posterUrl ? (
                <Image src={movie.posterUrl} alt={movie.title} fill sizes="44px" className="object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{movie.title}</p>
              <p className="label mt-1">
                {movie.year ?? "----"} {movie.genres.length ? `· ${movie.genres.join(" / ")}` : ""}
              </p>
              {mode === "rate" ? (
                <div className="mt-2">
                  <RatingInput
                    providerId={movie.providerId}
                    compact
                    initialScore={ratedIds.includes(movie.providerId) ? undefined : undefined}
                    onRated={(score) => onRated?.(movie.providerId, score)}
                  />
                </div>
              ) : null}
            </div>
            {mode === "browse" ? (
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link href={`/movie/${movie.providerId}`} prefetch={false} className="label text-[var(--accent)]">
                  OPEN
                </Link>
                <WatchlistButton providerId={movie.providerId} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {!loading && results.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">該当する作品が見つかりませんでした。</p>
      ) : null}
    </div>
  );
}
