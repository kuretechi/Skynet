import type { DiscoverQuery, MovieProvider, ProviderMovieDetail, ProviderMovieSummary } from "./types";

const API = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

type TmdbMovie = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  runtime?: number | null;
  original_language?: string;
  genres?: { id: number; name: string }[];
  genre_ids?: number[];
  production_countries?: { iso_3166_1: string }[];
  credits?: { cast?: { name: string }[]; crew?: { name: string; job: string }[] };
  keywords?: { keywords?: { name: string }[] };
};

/** TMDB implementation of the movie provider port. */
export class TmdbMovieProvider implements MovieProvider {
  readonly name = "tmdb";

  constructor(
    private readonly apiKey: string,
    private readonly language = process.env.TMDB_LANGUAGE || "ja-JP",
    private readonly region = process.env.TMDB_REGION || "JP",
  ) {}

  private async request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${API}${path}`);
    url.searchParams.set("language", this.language);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    const isBearer = this.apiKey.length > 40;
    if (!isBearer) url.searchParams.set("api_key", this.apiKey);

    const res = await fetch(url, {
      headers: isBearer ? { Authorization: `Bearer ${this.apiKey}` } : {},
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error(`TMDB request failed: ${res.status} ${path}`);
    return (await res.json()) as T;
  }

  /**
   * TMDB being unreachable, rate limited or misconfigured must not take a page
   * down: callers degrade to whatever is already cached in our own database.
   */
  private async tryRequest<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T | null> {
    try {
      return await this.request<T>(path, params);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private toSummary(m: TmdbMovie, genreNames?: Map<number, string>): ProviderMovieSummary {
    return {
      providerId: String(m.id),
      title: m.title,
      originalTitle: m.original_title,
      releaseDate: m.release_date || undefined,
      posterPath: m.poster_path ?? undefined,
      backdropPath: m.backdrop_path ?? undefined,
      overview: m.overview ?? "",
      popularity: m.popularity ?? 0,
      voteAverage: m.vote_average ?? 0,
      voteCount: m.vote_count ?? 0,
      genres:
        m.genres?.map((g) => g.name) ??
        (m.genre_ids ?? []).map((id) => genreNames?.get(id)).filter((n): n is string => Boolean(n)),
    };
  }

  private genreCache?: Map<number, string>;

  private async genres(): Promise<Map<number, string>> {
    if (this.genreCache) return this.genreCache;
    const data = await this.tryRequest<{ genres: { id: number; name: string }[] }>("/genre/movie/list");
    if (!data) return new Map();
    this.genreCache = new Map(data.genres.map((g) => [g.id, g.name]));
    return this.genreCache;
  }

  async search(query: string, page = 1): Promise<ProviderMovieSummary[]> {
    const [data, genreNames] = await Promise.all([
      this.tryRequest<{ results: TmdbMovie[] }>("/search/movie", { query, page, include_adult: "false" }),
      this.genres(),
    ]);
    return (data?.results ?? []).map((m) => this.toSummary(m, genreNames));
  }

  async detail(providerId: string): Promise<ProviderMovieDetail | null> {
    // TMDB ids are numeric, so anything else is a bad URL rather than a lookup.
    if (!/^\d+$/.test(providerId)) return null;
    const m = await this.tryRequest<TmdbMovie>(`/movie/${providerId}`, {
      append_to_response: "credits,keywords",
    });
    if (!m?.id) return null;
    const summary = this.toSummary(m);
    return {
      ...summary,
      runtime: m.runtime ?? undefined,
      country: m.production_countries?.[0]?.iso_3166_1,
      language: m.original_language,
      director: m.credits?.crew?.find((c) => c.job === "Director")?.name,
      cast: (m.credits?.cast ?? []).slice(0, 10).map((c) => c.name),
      keywords: (m.keywords?.keywords ?? []).map((k) => k.name),
    };
  }

  async discover(query: DiscoverQuery): Promise<ProviderMovieSummary[]> {
    const genreNames = await this.genres();
    const byName = new Map([...genreNames].map(([id, name]) => [name, id]));
    const data = await this.tryRequest<{ results: TmdbMovie[] }>("/discover/movie", {
      page: query.page ?? 1,
      region: this.region,
      sort_by: "popularity.desc",
      with_genres: query.genres?.map((g) => byName.get(g)).filter(Boolean).join(","),
      "primary_release_date.gte": query.yearFrom ? `${query.yearFrom}-01-01` : undefined,
      "primary_release_date.lte": query.yearTo ? `${query.yearTo}-12-31` : undefined,
      with_origin_country: query.country,
      "with_runtime.lte": query.runtimeMax,
    });
    return (data?.results ?? []).map((m) => this.toSummary(m, genreNames));
  }

  async popular(page = 1): Promise<ProviderMovieSummary[]> {
    const [data, genreNames] = await Promise.all([
      this.tryRequest<{ results: TmdbMovie[] }>("/movie/popular", { page, region: this.region }),
      this.genres(),
    ]);
    return (data?.results ?? []).map((m) => this.toSummary(m, genreNames));
  }

  async nowPlaying(page = 1): Promise<ProviderMovieSummary[]> {
    const [data, genreNames] = await Promise.all([
      this.tryRequest<{ results: TmdbMovie[] }>("/movie/now_playing", { page, region: this.region }),
      this.genres(),
    ]);
    return (data?.results ?? []).map((m) => this.toSummary(m, genreNames));
  }

  imageUrl(path: string | null | undefined, size: "poster" | "backdrop"): string | null {
    if (!path) return null;
    return `${IMAGE_BASE}/${size === "poster" ? "w500" : "w1280"}${path}`;
  }
}
