import { GoogleGenAI } from "@google/genai";
import { clampVector, pickVector } from "@/lib/dna/axes";
import type { ProviderMovieDetail } from "@/lib/movies/types";
import { logClassifierFailure, MOVIE_AXES_SCHEMA, moviePromptPayload, SYSTEM_PROMPT } from "./shared";
import type { AiClassification } from "./types";

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
const GEMINI_RETIRED_MODELS = new Set(["gemini-2.5-flash-lite"]);
const GEMINI_TIMEOUT_MS = 15_000;

function configuredGeminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (!configured || GEMINI_RETIRED_MODELS.has(configured)) {
    return GEMINI_DEFAULT_MODEL;
  }
  return configured;
}

export async function classifyWithGemini(
  movie: ProviderMovieDetail,
): Promise<AiClassification | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = configuredGeminiModel();
  try {
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    });
    const interaction = await client.interactions.create({
      model,
      store: false,
      system_instruction: SYSTEM_PROMPT,
      input: JSON.stringify(moviePromptPayload(movie)),
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: MOVIE_AXES_SCHEMA,
      },
    });
    if (!interaction.output_text) {
      logClassifierFailure("gemini", new Error("EMPTY_RESPONSE"), { model });
      return null;
    }
    return {
      vector: clampVector(pickVector(JSON.parse(interaction.output_text) as Record<string, unknown>)),
      provider: "gemini",
      model,
    };
  } catch (error) {
    logClassifierFailure("gemini", error, { model });
    return null;
  }
}
