export type AiProviderName = "gemini" | "openai";

type ProviderEnvironment = {
  [key: string]: string | undefined;
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
};

export const selectAiProvider = (environment: ProviderEnvironment): AiProviderName | null => {
  const selected = environment.AI_PROVIDER?.toLowerCase();
  if (selected === "gemini") return environment.GEMINI_API_KEY ? "gemini" : null;
  if (selected === "openai") return environment.OPENAI_API_KEY ? "openai" : null;
  if (environment.GEMINI_API_KEY) return "gemini";
  if (environment.OPENAI_API_KEY) return "openai";
  return null;
};
