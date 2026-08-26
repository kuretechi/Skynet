export const RECOMMENDER_VERSION = "personal-v2";
export const CONTENT_SIGNATURE_VERSION = "content-v1";
export const EXPERIENCE_VECTOR_VERSION = "experience-v2";

export const RECOMMENDER_CONFIG = {
  personalMeanPrior: 3,
  personalMeanPriorStrength: 3,
  preferenceScale: 2.25,
  masterpiecePreference: 1.2,
  facetPriors: {
    theme: 0.34,
    creators: 0.25,
    context: 0.16,
    format: 0.15,
    relations: 0.1,
  },
  facetEvidenceStrength: 4,
  islandMinimumRatings: 5,
  islandMaximumCount: 4,
  // A shared media type alone is ~0.31, so the floor must stay above it or
  // unrelated movie tastes collapse into one connected component.
  islandMinimumSimilarity: 0.4,
  experienceWeight: 0.1,
  experienceWeightMaximum: 0.15,
  moodWeight: 0.2,
  externalPriorMaximum: 0.3,
  confidenceRatingsStrength: 8,
  diversityPenalty: 0.16,
  directorRepeatPenalty: 0.08,
  genreRepeatPenalty: 0.05,
  relationRepeatPenalty: 0.12,
  islandRepeatPenalty: 0.04,
} as const;
