import type { AxisVector } from "@/lib/dna/axes";
import type { ProviderMovieDetail } from "@/lib/movies/types";

export type AiProvider = "gemini" | "openai";

export type AiClassification = {
  vector: AxisVector;
  provider: AiProvider;
  model: string;
};

export type MovieClassifier = (movie: ProviderMovieDetail) => Promise<AiClassification | null>;

