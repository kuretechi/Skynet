import { AXES, type AxisVector, clampVector, pickVector } from "@/lib/dna/axes";
import type { ProviderMovieDetail } from "@/lib/movies/types";
import { anchorPromptBlock } from "./anchors";

const SYSTEM_PROMPT = `You classify films on 8 fixed axes for a personal cinema platform.
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

export const isLlmConfigured = () => Boolean(process.env.OPENAI_API_KEY);

/**
 * Fixed-schema LLM classification of a movie. Returns null when no LLM is
 * configured or the call fails, so generation can fall back to rules only.
 */
export async function classifyWithLlm(movie: ProviderMovieDetail): Promise<AxisVector | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const payload = {
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
  };

  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "movie_axes",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: [...AXES],
              properties: Object.fromEntries(
                AXES.map((axis) => [axis, { type: "number", minimum: 0, maximum: 1 }]),
              ),
            },
          },
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return clampVector(pickVector(JSON.parse(content) as Record<string, unknown>));
  } catch {
    return null;
  }
}
