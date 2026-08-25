import type { ProviderMovieDetail } from "@/lib/movies/types";
import { classifyWithGemini } from "./providers/gemini";
import { classifyWithOpenAi } from "./providers/openai";
import { selectAiProvider } from "./provider-selection";
import type { AiClassification } from "./providers/types";

export const configuredAiProvider = () => selectAiProvider(process.env);

export const isLlmConfigured = () => configuredAiProvider() !== null;

export async function classifyWithLlm(
  movie: ProviderMovieDetail,
): Promise<AiClassification | null> {
  const provider = configuredAiProvider();
  if (provider === "gemini") return classifyWithGemini(movie);
  if (provider === "openai") return classifyWithOpenAi(movie);
  return null;
}
