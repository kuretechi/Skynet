import { MOCK_CATALOG } from "./mock-catalog";
import type { DiscoverQuery, MovieProvider, ProviderMovieDetail, ProviderMovieSummary } from "./types";

const toSummary = (m: ProviderMovieDetail): ProviderMovieSummary => ({
  providerId: m.providerId,
  title: m.title,
  originalTitle: m.originalTitle,
  releaseDate: m.releaseDate,
  posterPath: m.posterPath,
  backdropPath: m.backdropPath,
  overview: m.overview,
  popularity: m.popularity,
  voteAverage: m.voteAverage,
  voteCount: m.voteCount,
  genres: m.genres,
});

const year = (m: ProviderMovieDetail) => Number(m.releaseDate?.slice(0, 4) ?? 0);

/** Offline provider used when no external credentials are configured. */
export class MockMovieProvider implements MovieProvider {
  readonly name = "mock";

  async search(query: string): Promise<ProviderMovieSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MOCK_CATALOG.filter((m) =>
      [m.title, m.originalTitle ?? "", m.director ?? "", ...m.cast, ...m.keywords]
        .join(" ")
        .toLowerCase()
        .includes(q),
    ).map(toSummary);
  }

  async detail(providerId: string): Promise<ProviderMovieDetail | null> {
    return MOCK_CATALOG.find((m) => m.providerId === providerId) ?? null;
  }

  async discover(query: DiscoverQuery): Promise<ProviderMovieSummary[]> {
    return MOCK_CATALOG.filter((m) => {
      if (query.genres?.length && !query.genres.some((g) => m.genres.includes(g))) return false;
      if (query.yearFrom && year(m) < query.yearFrom) return false;
      if (query.yearTo && year(m) > query.yearTo) return false;
      if (query.country && m.country !== query.country) return false;
      if (query.runtimeMax && (m.runtime ?? 0) > query.runtimeMax) return false;
      return true;
    }).map(toSummary);
  }

  async popular(): Promise<ProviderMovieSummary[]> {
    return [...MOCK_CATALOG].sort((a, b) => b.popularity - a.popularity).map(toSummary);
  }

  imageUrl(): string | null {
    return null;
  }
}
