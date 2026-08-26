"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MOODS } from "@/lib/recommend/moods";
import { RatingInput } from "./rating-input";
import { WatchlistButton } from "./watchlist-button";

export type SearchResult = { providerId: string; title: string; year: string | null; posterUrl: string | null; genres: string[];
  director?: string | null; forYou?: number | null; match?: number | null; moodMatch?: number | null; analyzed?: boolean };
type Sort = "for-you" | "match" | "release";

function useSearch(query: string, mood: string, sort: Sort) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, sort });
        if (mood) params.set("mood", mood);
        const response = await fetch(`/api/movies/search?${params}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, mood, sort]);
  return { results, loading };
}

export function MovieSearch({ mode = "browse", ratedIds = [], onRated, placeholder = "タイトル・監督・キーワードで検索", unified = false }:
  { mode?: "browse" | "rate"; ratedIds?: string[]; onRated?: (providerId: string, score: number) => void; placeholder?: string; unified?: boolean }) {
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState("");
  const [sort, setSort] = useState<Sort>("for-you");
  const { results, loading } = useSearch(query, unified ? mood : "", unified ? sort : "for-you");
  return <div className="flex flex-col gap-4">
    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder}
      className="w-full border-b-2 border-[var(--accent)] bg-transparent pb-3 text-lg outline-none placeholder:text-[var(--muted)] focus:shadow-[0_8px_18px_-14px_var(--accent)]" />
    {unified ? <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">{MOODS.map((item) => <button key={item.id} type="button" onClick={() => setMood(mood === item.id ? "" : item.id)}
        className="border px-3 py-2 text-xs" style={{ borderColor: mood === item.id ? "var(--accent)" : "var(--line)", color: mood === item.id ? "var(--accent)" : "var(--foreground)" }}>{item.label}</button>)}</div>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
        <span className="label">{results.length} RESULTS</span>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="並べ替え"
          className="border border-[var(--line)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]">
          <option value="for-you">FOR YOU スコア順</option><option value="match">マッチ順</option><option value="release">公開日順</option>
        </select>
      </div>
    </div> : null}
    {loading ? <p className="label">SEARCHING…</p> : null}
    <ul className="flex flex-col divide-y divide-[var(--line)]" aria-busy={loading}>{results.map((movie) => <li key={movie.providerId} className="flex items-center gap-4 py-3">
      <Link href={`/movie/${movie.providerId}`} prefetch={false} className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative h-20 w-14 shrink-0 overflow-hidden border border-[var(--line)] bg-[var(--surface-2)]">{movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.title} fill sizes="56px" className="object-cover" /> : null}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm">{movie.title}</p><p className="label mt-1">{movie.year ?? "----"}{movie.director ? ` · ${movie.director}` : ""}</p>
          <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{movie.genres.join(" / ")}</p>
          {unified ? <p className="mt-2 font-mono text-[10px] text-[var(--accent)]">{movie.forYou != null ? `FOR YOU ${movie.forYou.toFixed(1)}` : "未分析"}{movie.match != null ? ` · ${movie.match}% MATCH` : ""}{movie.moodMatch != null ? ` · MOOD ${movie.moodMatch}%` : ""}</p> : null}
          {mode === "rate" ? <div className="mt-2"><RatingInput providerId={movie.providerId} compact initialScore={ratedIds.includes(movie.providerId) ? undefined : undefined} onRated={(score) => onRated?.(movie.providerId, score)} /></div> : null}
        </div>
      </Link>
      {mode === "browse" ? <div className="shrink-0"><WatchlistButton providerId={movie.providerId} /></div> : null}
    </li>)}</ul>
    {!loading && results.length === 0 ? <p className="text-sm text-[var(--muted)]">該当する作品が見つかりませんでした。</p> : null}
  </div>;
}
