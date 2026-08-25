import { clampVector, pickVector } from "@/lib/dna/axes";
import type { ProviderMovieDetail } from "@/lib/movies/types";
import { logClassifierFailure, MOVIE_AXES_SCHEMA, moviePromptPayload, SYSTEM_PROMPT } from "./shared";
import type { AiClassification } from "./types";

export async function classifyWithOpenAi(
  movie: ProviderMovieDetail,
): Promise<AiClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(moviePromptPayload(movie)) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "movie_axes", strict: true, schema: MOVIE_AXES_SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logClassifierFailure("openai", new Error(`HTTP_${res.status}`), { model, status: res.status });
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return {
      vector: clampVector(pickVector(JSON.parse(content) as Record<string, unknown>)),
      provider: "openai",
      model,
    };
  } catch (error) {
    logClassifierFailure("openai", error, { model });
    return null;
  }
}

