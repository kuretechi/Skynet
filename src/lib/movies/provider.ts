import { MockMovieProvider } from "./mock-provider";
import { TmdbMovieProvider } from "./tmdb-provider";
import type { MovieProvider } from "./types";

let cached: MovieProvider | undefined;

/**
 * Returns the configured movie metadata provider. Falls back to the offline
 * mock catalog when no TMDB credentials are present so the app stays runnable.
 */
export function getMovieProvider(): MovieProvider {
  if (cached) return cached;
  const key = process.env.TMDB_API_KEY;
  cached = key ? new TmdbMovieProvider(key) : new MockMovieProvider();
  return cached;
}

export const providerAttribution = (name: string) =>
  name === "tmdb"
    ? "This product uses the TMDB API but is not endorsed or certified by TMDB."
    : "Development catalog — no external provider configured.";
