import { AXES } from "@/lib/dna/axes";
import type { ProviderMovieDetail } from "@/lib/movies/types";
import { anchorPromptBlock } from "../anchors";

export const SYSTEM_PROMPT = `You classify films on 8 fixed axes for a personal cinema platform.
Use ONLY the provided metadata. Do not rely on unrelated knowledge, and never invent facts.
Return each axis as a number between 0.0 and 1.0.

Axes:
- feel: emotional intensity and warmth
- think: intellectual demand, interpretation, ambiguity
- immerse: strength of world and atmosphere
- story: plot structure, narrative drive, twists
- sense: visual / sonic / aesthetic craft
- pulse: tension, speed, kinetic energy
- explore: distance from the mainstream, experimentation
- depth: weight, resonance, lingering aftertaste

Calibration anchors:
${anchorPromptBlock()}`;

export const MOVIE_AXES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...AXES],
  properties: Object.fromEntries(
    AXES.map((axis) => [axis, { type: "number", minimum: 0, maximum: 1 }]),
  ),
};

export const moviePromptPayload = (movie: ProviderMovieDetail) => ({
  title: movie.title,
  original_title: movie.originalTitle,
  overview: movie.overview,
  genres: movie.genres,
  keywords: movie.keywords,
  director: movie.director,
  cast: movie.cast.slice(0, 6),
  runtime: movie.runtime,
  release_year: Number(movie.releaseDate?.slice(0, 4)) || undefined,
  country: movie.country,
  language: movie.language,
  popularity: movie.popularity,
  vote_average: movie.voteAverage,
  vote_count: movie.voteCount,
});

export const logClassifierFailure = (
  provider: string,
  error: unknown,
  context?: Record<string, unknown>,
) => {
  const details = error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };
  console.error("movie AI classification failed", { provider, ...context, ...details });
};

