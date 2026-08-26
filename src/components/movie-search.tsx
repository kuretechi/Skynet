"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MOODS } from "@/lib/recommend/moods";
import { RatingInput } from "./rating-input";
import { WatchlistButton } from "./watchlist-button";

export type SearchResult = {
  providerId: string;
  title: string;
  originalTitle?: string | null;
  year: string | null;
  posterUrl: string | null;
  genres: string[];
  runtime?: number | null;
  country?: string | null;
  director?: string | null;
  forYou?: number | null;
  match?: number | null;
  moodMatch?: number | null;
  analyzed?: boolean;
};

type Sort = "for-you" | "match" | "release";
type Filters = {
  unwatched: boolean;
  runtimeMin: number;
  runtimeMax: number;
  genre: string;
  decade: string;
  country: string;
};

const DEFAULT_FILTERS: Filters = { unwatched: false, runtimeMin: 40, runtimeMax: 240, genre: "", decade: "", country: "" };
const GENRES = ["アクション", "アドベンチャー", "アニメーション", "コメディ", "犯罪", "ドラマ", "ファミリー", "ファンタジー", "ホラー", "ミステリー", "ロマンス", "サイエンスフィクション", "スリラー", "ドキュメンタリー"];
const COUNTRIES = [["JP", "日本"], ["US", "アメリカ"], ["GB", "イギリス"], ["KR", "韓国"], ["FR", "フランス"], ["CN", "中国"], ["HK", "香港"], ["DE", "ドイツ"], ["IT", "イタリア"], ["ES", "スペイン"], ["IN", "インド"], ["CA", "カナダ"], ["AU", "オーストラリア"]] as const;

function useSearch(query: string, mood: string, sort: Sort, filters: Filters) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, sort });
        if (mood) params.set("mood", mood);
        if (filters.unwatched) params.set("unwatched", "1");
        if (filters.genre) params.set("genre", filters.genre);
        if (filters.country) params.set("country", filters.country);
        if (filters.runtimeMin !== DEFAULT_FILTERS.runtimeMin || filters.runtimeMax !== DEFAULT_FILTERS.runtimeMax) {
          params.set("runtimeMin", String(filters.runtimeMin));
          params.set("runtimeMax", String(filters.runtimeMax));
        }
        if (filters.decade) {
          const from = Number(filters.decade);
          params.set("yearFrom", String(from));
          params.set("yearTo", String(from + 9));
        }
        const response = await fetch(`/api/movies/search?${params}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, mood, sort, filters]);
  return { results, loading };
}

export function MovieSearch({ mode = "browse", ratedIds = [], onRated, placeholder = "タイトル・原題・別題・監督・キーワード", unified = false }:
  { mode?: "browse" | "rate"; ratedIds?: string[]; onRated?: (providerId: string, score: number) => void; placeholder?: string; unified?: boolean }) {
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState("");
  const [sort, setSort] = useState<Sort>("for-you");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const activeFilters = Number(filters.unwatched) + Number(Boolean(filters.genre)) + Number(Boolean(filters.decade)) + Number(Boolean(filters.country)) + Number(filters.runtimeMin !== 40 || filters.runtimeMax !== 240);
  const { results, loading } = useSearch(query, unified ? mood : "", unified ? sort : "for-you", unified ? filters : DEFAULT_FILTERS);
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  return <div className="flex flex-col gap-4">
    <div className="search-shell flex items-center gap-3 border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-3">
      <span className="text-lg text-[var(--accent)]" aria-hidden>⌕</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder}
        aria-label="映画を検索" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base outline-none placeholder:text-[var(--muted)]" />
    </div>

    {unified ? <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">{MOODS.map((item) => <button key={item.id} type="button" onClick={() => setMood(mood === item.id ? "" : item.id)}
        className="border px-3 py-2 text-xs" style={{ borderColor: mood === item.id ? "var(--accent)" : "var(--line)", color: mood === item.id ? "var(--accent)" : "var(--foreground)" }}>{item.label}</button>)}</div>

      <details className="search-filter-panel border-y border-[var(--line)] py-3">
        <summary className="label flex cursor-pointer list-none items-center justify-between text-[var(--foreground)]">
          <span>FILTERS{activeFilters ? ` · ${activeFilters}` : ""}</span><span aria-hidden>＋</span>
        </summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={filters.unwatched} onChange={(event) => updateFilter("unwatched", event.target.checked)} />未鑑賞のみ
          </label>
          <label className="flex flex-col gap-2 text-xs"><span className="label">ジャンル</span>
            <select value={filters.genre} onChange={(event) => updateFilter("genre", event.target.value)}><option value="">すべて</option>{GENRES.map((genre) => <option key={genre}>{genre}</option>)}</select>
          </label>
          <label className="flex flex-col gap-2 text-xs"><span className="label">年代</span>
            <select value={filters.decade} onChange={(event) => updateFilter("decade", event.target.value)}><option value="">すべて</option>{[2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950].map((year) => <option key={year} value={year}>{year}年代</option>)}</select>
          </label>
          <label className="flex flex-col gap-2 text-xs"><span className="label">制作国</span>
            <select value={filters.country} onChange={(event) => updateFilter("country", event.target.value)}><option value="">すべて</option>{COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
          </label>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <div className="flex items-center justify-between"><span className="label">上映時間</span><span className="text-xs text-[var(--accent)]">{filters.runtimeMin}分〜{filters.runtimeMax}分</span></div>
            <label className="grid grid-cols-[3.5rem_1fr] items-center gap-3 text-xs"><span>最短</span><input type="range" min="40" max="240" step="10" value={filters.runtimeMin} onChange={(event) => updateFilter("runtimeMin", Math.min(Number(event.target.value), filters.runtimeMax - 10))} /></label>
            <label className="grid grid-cols-[3.5rem_1fr] items-center gap-3 text-xs"><span>最長</span><input type="range" min="40" max="240" step="10" value={filters.runtimeMax} onChange={(event) => updateFilter("runtimeMax", Math.max(Number(event.target.value), filters.runtimeMin + 10))} /></label>
          </div>
          {activeFilters ? <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="label justify-self-start border border-[var(--line)] px-3 py-2 text-[var(--muted)] sm:col-span-2">CLEAR FILTERS</button> : null}
        </div>
      </details>

      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-2">
        <span className="label">{results.length} RESULTS</span>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="並べ替え"
          className="border border-[var(--line)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]">
          <option value="for-you">FOR YOU スコア順</option><option value="match">マッチ順</option><option value="release">公開日順</option>
        </select>
      </div>
    </div> : null}

    {loading ? <p className="label">SEARCHING…</p> : null}
    <ul className="search-results flex flex-col divide-y divide-[var(--line)]" aria-busy={loading}>{results.map((movie) => <li key={movie.providerId} className="grid grid-cols-[minmax(0,1fr)_5.75rem] items-center gap-3 py-3">
      <Link href={`/movie/${movie.providerId}`} prefetch={false} className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
        <div className="relative h-20 w-14 overflow-hidden border border-[var(--line)] bg-[var(--surface-2)]">{movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.title} fill sizes="56px" className="object-cover" /> : null}</div>
        <div className="min-w-0">
          <p className="truncate text-sm">{movie.title}</p>
          {movie.originalTitle && movie.originalTitle !== movie.title ? <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{movie.originalTitle}</p> : null}
          <p className="label mt-1 truncate">{movie.year ?? "----"}{movie.director ? ` · ${movie.director}` : ""}</p>
          <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{movie.genres.join(" / ")}{movie.runtime ? ` · ${movie.runtime}分` : ""}</p>
          {mode === "rate" ? <div className="mt-2"><RatingInput providerId={movie.providerId} compact initialScore={ratedIds.includes(movie.providerId) ? undefined : undefined} onRated={(score) => onRated?.(movie.providerId, score)} /></div> : null}
        </div>
      </Link>
      {mode === "browse" ? <div className="flex min-w-0 flex-col items-stretch gap-2 text-right">
        <div><span className="label block">{movie.moodMatch != null ? "MOOD" : "FOR YOU"}</span>
          <span className="display text-2xl text-[var(--accent)]">{movie.moodMatch != null ? `${movie.moodMatch}%` : movie.forYou != null ? movie.forYou.toFixed(1) : "—"}</span>
          {movie.match != null ? <span className="block font-mono text-[9px] text-[var(--muted)]">{movie.match}% MATCH</span> : null}
        </div>
        <WatchlistButton providerId={movie.providerId} />
      </div> : null}
    </li>)}</ul>
    {!loading && results.length === 0 ? <p className="text-sm text-[var(--muted)]">条件に合う作品が見つかりませんでした。</p> : null}
  </div>;
}
