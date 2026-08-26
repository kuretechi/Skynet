export type ProviderMovieSummary = {
  providerId: string;
  mediaType?: "movie" | "tv";
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  posterPath?: string;
  backdropPath?: string;
  overview: string;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  genres: string[];
  genreIds?: string[];
};

export type ProviderEntity = {
  id?: string;
  name: string;
};

export type ProviderMovieDetail = ProviderMovieSummary & {
  runtime?: number;
  country?: string;
  countries?: string[];
  language?: string;
  director?: string;
  directorId?: string;
  writers?: ProviderEntity[];
  cast: string[];
  castIds?: string[];
  keywords: string[];
  keywordIds?: string[];
  companies?: ProviderEntity[];
  collection?: ProviderEntity;
};

export type DiscoverQuery = {
  genres?: string[];
  yearFrom?: number;
  yearTo?: number;
  country?: string;
  runtimeMax?: number;
  page?: number;
};

/**
 * Movie metadata source. Implementations must be interchangeable so the
 * product is not locked to a single external provider.
 */
export interface MovieProvider {
  readonly name: string;
  search(query: string, page?: number): Promise<ProviderMovieSummary[]>;
  detail(providerId: string): Promise<ProviderMovieDetail | null>;
  discover(query: DiscoverQuery): Promise<ProviderMovieSummary[]>;
  popular(page?: number): Promise<ProviderMovieSummary[]>;
  /** Highly rated catalogue titles, used to keep bootstrap data from being recency-only. */
  topRated(page?: number): Promise<ProviderMovieSummary[]>;
  /** Titles released recently, so new films reach the catalogue on their own. */
  nowPlaying(page?: number): Promise<ProviderMovieSummary[]>;
  imageUrl(path: string | null | undefined, size: "poster" | "backdrop"): string | null;
}
