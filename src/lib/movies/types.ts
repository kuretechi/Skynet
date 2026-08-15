export type ProviderMovieSummary = {
  providerId: string;
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
};

export type ProviderMovieDetail = ProviderMovieSummary & {
  runtime?: number;
  country?: string;
  language?: string;
  director?: string;
  cast: string[];
  keywords: string[];
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
  imageUrl(path: string | null | undefined, size: "poster" | "backdrop"): string | null;
}
