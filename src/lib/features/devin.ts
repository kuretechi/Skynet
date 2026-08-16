import { AXES, type AxisVector, clampVector, pickVector } from "@/lib/dna/axes";
import type { ProviderMovieDetail } from "@/lib/movies/types";
import { anchorPromptBlock } from "./anchors";

const INSTRUCTIONS = `You classify films on 8 fixed axes for a personal cinema platform.
This is a pure classification task: do not clone repositories, run commands, or write code.
Use ONLY the metadata provided below. Do not rely on unrelated knowledge, and never invent facts.
Return each axis as a number between 0.0 and 1.0 in the structured output.

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

const AXIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...AXES],
  properties: Object.fromEntries(AXES.map((axis) => [axis, { type: "number", minimum: 0, maximum: 1 }])),
};

const apiBaseUrl = () => process.env.DEVIN_API_BASE_URL ?? "https://api.devin.ai";
const pollIntervalMs = () => Number(process.env.DEVIN_POLL_INTERVAL_MS) || 5_000;
const timeoutMs = () => Number(process.env.DEVIN_TIMEOUT_MS) || 180_000;
const maxAcuLimit = () => Number(process.env.DEVIN_MAX_ACU_LIMIT) || 3;

const TERMINAL_STATUSES = new Set(["finished", "blocked", "expired"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isDevinConfigured = () => Boolean(process.env.DEVIN_API_KEY);

type SessionDetail = {
  status_enum?: string | null;
  structured_output?: Record<string, unknown> | null;
};

/**
 * Fixed-schema classification of a movie via the Devin API. Returns null when
 * no API key is configured or the session fails, so generation can fall back to
 * rules only.
 */
export async function classifyWithDevin(movie: ProviderMovieDetail): Promise<AxisVector | null> {
  const apiKey = process.env.DEVIN_API_KEY;
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
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };

  try {
    const created = await fetch(`${apiBaseUrl()}/v1/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: `${INSTRUCTIONS}\n\nMovie metadata (JSON):\n${JSON.stringify(payload)}`,
        structured_output_schema: AXIS_SCHEMA,
        title: `Axis classification: ${movie.title}`,
        tags: ["personal-cinema", "feature-generation"],
        unlisted: true,
        idempotent: true,
        max_acu_limit: maxAcuLimit(),
      }),
    });
    if (!created.ok) return null;
    const { session_id: sessionId } = (await created.json()) as { session_id?: string };
    if (!sessionId) return null;

    const deadline = Date.now() + timeoutMs();
    while (Date.now() < deadline) {
      await sleep(pollIntervalMs());
      const res = await fetch(`${apiBaseUrl()}/v1/sessions/${sessionId}`, { headers });
      if (!res.ok) return null;
      const detail = (await res.json()) as SessionDetail;
      if (detail.structured_output) return clampVector(pickVector(detail.structured_output));
      if (detail.status_enum && TERMINAL_STATUSES.has(detail.status_enum)) return null;
    }
    return null;
  } catch {
    return null;
  }
}
