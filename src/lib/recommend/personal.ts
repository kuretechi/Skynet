import type { AxisVector } from "@/lib/dna/axes";
import { euclideanDistance } from "@/lib/dna/axes";
import { FACETS, type ContentSignature, type Facet, type FacetWeights } from "@/lib/signatures/types";
import { buildFrequencyIndex, signatureSimilarity, type FrequencyIndex } from "@/lib/signatures/similarity";
import { RECOMMENDER_CONFIG, RECOMMENDER_VERSION } from "./config";
import type { ForYouScore } from "./for-you";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

export type RatedTasteItem = {
  movieId: string;
  title: string;
  score: number;
  masterpiece: boolean;
  signature: ContentSignature;
  vector: AxisVector;
};

export type PreferenceSignal = RatedTasteItem & {
  preference: number;
};

export type TasteIsland = {
  id: string;
  movieIds: string[];
  representativeTitles: string[];
  strength: number;
};

export type PersonalTasteProfile = {
  version: string;
  ratingCount: number;
  meanRating: number;
  signals: PreferenceSignal[];
  facetWeights: FacetWeights;
  facetReliability: FacetWeights;
  islands: TasteIsland[];
  confidence: number;
};

export type FacetAffinityResult = {
  value: number | null;
  evidence: number;
  neighbours: number;
};

export type PersonalScoreTrace = {
  facets: Record<Facet, FacetAffinityResult>;
  facetWeights: FacetWeights;
  rawAffinity: number;
  islandAffinity: number | null;
  islandId: string | null;
  contentMatch: number;
  experienceMatch: number | null;
  moodMatch: number | null;
  reasons: string[];
};

export type PersonalScoreResult = {
  score: ForYouScore;
  trace: PersonalScoreTrace;
  explanation: string;
};

export function shrunkPersonalMean(scores: number[]) {
  const { personalMeanPrior, personalMeanPriorStrength } = RECOMMENDER_CONFIG;
  const total = scores.reduce((sum, value) => sum + value, 0);
  return (total + personalMeanPrior * personalMeanPriorStrength) / (scores.length + personalMeanPriorStrength);
}

export function preferenceSignal(score: number, mean: number, masterpiece = false) {
  if (masterpiece) return RECOMMENDER_CONFIG.masterpiecePreference;
  return clamp((score - mean) / RECOMMENDER_CONFIG.preferenceScale, -1, 1);
}

function facetAffinity(
  candidate: ContentSignature,
  signals: PreferenceSignal[],
  facet: Facet,
  index: FrequencyIndex,
): FacetAffinityResult {
  let numerator = 0;
  let denominator = 0;
  let evidence = 0;
  let neighbours = 0;
  for (const signal of signals) {
    if (Math.abs(signal.preference) < 0.02) continue;
    const result = signatureSimilarity(candidate, signal.signature, index).facets[facet];
    if (result.value === null || result.value <= 0) continue;
    const weight = Math.abs(signal.preference) * result.value * Math.max(0.2, result.evidence);
    numerator += Math.sign(signal.preference) * weight;
    denominator += weight;
    evidence += result.evidence;
    neighbours += 1;
  }
  return {
    value: denominator ? clamp(numerator / denominator, -1, 1) : null,
    evidence: neighbours ? clamp01(evidence / neighbours) : 0,
    neighbours,
  };
}

function facetReliability(signals: PreferenceSignal[], facet: Facet, index: FrequencyIndex) {
  if (signals.length < 2) return 0;
  let quality = 0;
  let evaluated = 0;
  for (const target of signals) {
    if (Math.abs(target.preference) < 0.05) continue;
    const predicted = facetAffinity(target.signature, signals.filter((signal) => signal.movieId !== target.movieId), facet, index);
    if (predicted.value === null) continue;
    const directional = Math.sign(predicted.value) === Math.sign(target.preference) ? 1 : 0;
    const errorQuality = 1 - Math.min(1, Math.abs(predicted.value - target.preference) / 2);
    quality += directional * 0.65 + errorQuality * 0.35;
    evaluated += 1;
  }
  if (!evaluated) return 0;
  const evidenceConfidence = evaluated / (evaluated + RECOMMENDER_CONFIG.facetEvidenceStrength);
  return clamp01((quality / evaluated) * evidenceConfidence);
}

function normaliseWeights(weights: FacetWeights): FacetWeights {
  const sum = FACETS.reduce((total, facet) => total + weights[facet], 0) || 1;
  return FACETS.reduce((result, facet) => ({ ...result, [facet]: weights[facet] / sum }), {} as FacetWeights);
}

function percentile(values: number[], position: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * position))];
}

function buildTasteIslands(signals: PreferenceSignal[], index: FrequencyIndex): TasteIsland[] {
  const positive = signals.filter((signal) => signal.preference > 0.08);
  if (!positive.length) return [];
  if (signals.length < RECOMMENDER_CONFIG.islandMinimumRatings || positive.length < 3) {
    return [{
      id: "island-1",
      movieIds: positive.map((item) => item.movieId),
      representativeTitles: positive.sort((a, b) => b.preference - a.preference).slice(0, 3).map((item) => item.title),
      strength: positive.reduce((sum, item) => sum + item.preference, 0),
    }];
  }

  const pairSimilarities: number[] = [];
  for (let left = 0; left < positive.length; left += 1) {
    for (let right = left + 1; right < positive.length; right += 1) {
      pairSimilarities.push(signatureSimilarity(positive[left].signature, positive[right].signature, index).overall);
    }
  }
  const threshold = Math.max(
    RECOMMENDER_CONFIG.islandMinimumSimilarity,
    percentile(pairSimilarities, 0.55),
  );
  const unseen = new Set(positive.map((item) => item.movieId));
  const byId = new Map(positive.map((item) => [item.movieId, item]));
  const groups: PreferenceSignal[][] = [];

  while (unseen.size) {
    const seedId = [...unseen].sort()[0];
    const queue = [seedId];
    const group: PreferenceSignal[] = [];
    unseen.delete(seedId);
    while (queue.length) {
      const current = byId.get(queue.shift()!);
      if (!current) continue;
      group.push(current);
      for (const candidateId of [...unseen]) {
        const candidate = byId.get(candidateId)!;
        if (signatureSimilarity(current.signature, candidate.signature, index).overall >= threshold) {
          unseen.delete(candidateId);
          queue.push(candidateId);
        }
      }
    }
    groups.push(group);
  }

  groups.sort((a, b) =>
    b.reduce((sum, item) => sum + item.preference, 0) - a.reduce((sum, item) => sum + item.preference, 0),
  );
  const kept = groups.slice(0, RECOMMENDER_CONFIG.islandMaximumCount);
  const overflow = groups.slice(RECOMMENDER_CONFIG.islandMaximumCount).flat();
  if (overflow.length && kept.length) kept[kept.length - 1].push(...overflow);

  return kept.map((group, indexValue) => ({
    id: `island-${indexValue + 1}`,
    movieIds: group.map((item) => item.movieId),
    representativeTitles: [...group].sort((a, b) => b.preference - a.preference).slice(0, 3).map((item) => item.title),
    strength: group.reduce((sum, item) => sum + item.preference, 0),
  }));
}

export function buildPersonalTasteProfile(items: RatedTasteItem[]): PersonalTasteProfile {
  const meanRating = shrunkPersonalMean(items.map((item) => item.score));
  const signals = items.map((item) => ({
    ...item,
    preference: preferenceSignal(item.score, meanRating, item.masterpiece),
  }));
  const index = buildFrequencyIndex(signals.map((signal) => signal.signature));
  const reliability = FACETS.reduce((result, facet) => ({
    ...result,
    [facet]: facetReliability(signals, facet, index),
  }), {} as FacetWeights);
  const evidenceConfidence = items.length / (items.length + RECOMMENDER_CONFIG.facetEvidenceStrength);
  const adaptive = FACETS.reduce((result, facet) => ({
    ...result,
    [facet]: RECOMMENDER_CONFIG.facetPriors[facet] * (1 - evidenceConfidence)
      + reliability[facet] * evidenceConfidence,
  }), {} as FacetWeights);
  return {
    version: RECOMMENDER_VERSION,
    ratingCount: items.length,
    meanRating,
    signals,
    facetWeights: normaliseWeights(adaptive),
    facetReliability: reliability,
    islands: buildTasteIslands(signals, index),
    confidence: clamp01(items.length / (items.length + RECOMMENDER_CONFIG.confidenceRatingsStrength)),
  };
}

function islandAffinity(
  candidate: ContentSignature,
  profile: PersonalTasteProfile,
  index: FrequencyIndex,
) {
  let best: { id: string; value: number } | null = null;
  for (const island of profile.islands) {
    const members = profile.signals.filter((signal) => island.movieIds.includes(signal.movieId));
    let numerator = 0;
    let denominator = 0;
    for (const member of members) {
      const similarity = signatureSimilarity(candidate, member.signature, index, profile.facetWeights);
      const weight = Math.max(0, member.preference) * Math.max(0.2, similarity.evidence);
      numerator += similarity.overall * weight;
      denominator += weight;
    }
    const value = denominator ? numerator / denominator : 0;
    if (!best || value > best.value) best = { id: island.id, value };
  }
  return best;
}

function experienceMatch(dna: AxisVector, movie: AxisVector) {
  return clamp01(1 - euclideanDistance(dna, movie) / Math.sqrt(8));
}

function explanationFor(
  candidate: ContentSignature,
  profile: PersonalTasteProfile,
  index: FrequencyIndex,
  moodLabel?: string,
) {
  const positive = profile.signals
    .filter((signal) => signal.preference > 0.08)
    .map((signal) => ({
      signal,
      similarity: signatureSimilarity(candidate, signal.signature, index, profile.facetWeights),
    }))
    .sort((a, b) => b.similarity.overall - a.similarity.overall);
  const nearest = positive[0];
  if (!nearest) {
    return moodLabel
      ? `「${moodLabel}」との一致を優先した候補です。評価が増えると、より個人向けに調整されます。`
      : "評価が増えると、作品の事実特徴からあなた向けに調整されます。";
  }
  const nextTitle = positive[1]?.similarity.overall && positive[1].similarity.overall > 0.25
    ? `と『${positive[1].signal.title}』`
    : "";
  const reason = nearest.similarity.reasons.slice(0, 2).join("、");
  const mood = moodLabel ? `「${moodLabel}」という今の気分も反映しています。` : "";
  return `高く評価した『${nearest.signal.title}』${nextTitle}に近い${reason || "作品特徴"}を持つ候補です。${mood}`;
}

export function scorePersonalCandidate({
  candidate,
  profile,
  index,
  movieVector,
  movieVectorConfidence,
  dna,
  dnaConfidence,
  externalScore,
  mood,
}: {
  candidate: ContentSignature;
  profile: PersonalTasteProfile;
  index: FrequencyIndex;
  movieVector: AxisVector;
  movieVectorConfidence: number;
  dna: AxisVector;
  dnaConfidence: number;
  externalScore?: { score: number; scale: number; voteCount: number } | null;
  mood?: { label: string; target: AxisVector } | null;
}): PersonalScoreResult {
  const facets = FACETS.reduce((result, facet) => ({
    ...result,
    [facet]: facetAffinity(candidate, profile.signals, facet, index),
  }), {} as Record<Facet, FacetAffinityResult>);
  let affinityNumerator = 0;
  let affinityDenominator = 0;
  let candidateEvidence = 0;
  let candidateNeighbours = 0;
  for (const facet of FACETS) {
    const result = facets[facet];
    if (result.value === null) continue;
    const weight = profile.facetWeights[facet] * Math.max(0.2, result.evidence);
    affinityNumerator += result.value * weight;
    affinityDenominator += weight;
    candidateEvidence += result.evidence * profile.facetWeights[facet];
    candidateNeighbours += result.neighbours;
  }
  const rawAffinity = affinityDenominator ? affinityNumerator / affinityDenominator : 0;
  const island = islandAffinity(candidate, profile, index);
  const globalMatch = clamp01((rawAffinity + 1) / 2);
  let contentMatch = profile.ratingCount === 0
    ? 0.5
    : island
      ? globalMatch * 0.72 + island.value * 0.28
      : globalMatch;

  const axisMatch = experienceMatch(dna, movieVector);
  const axisWeight = Math.min(
    RECOMMENDER_CONFIG.experienceWeightMaximum,
    RECOMMENDER_CONFIG.experienceWeight * dnaConfidence * movieVectorConfidence,
  );
  contentMatch = contentMatch * (1 - axisWeight) + axisMatch * axisWeight;

  const moodMatch = mood ? experienceMatch(mood.target, movieVector) : null;
  if (moodMatch !== null) {
    const moodWeight = RECOMMENDER_CONFIG.moodWeight * Math.max(0.25, movieVectorConfidence);
    contentMatch = contentMatch * (1 - moodWeight) + moodMatch * moodWeight;
  }
  if (rawAffinity < -0.3) contentMatch = Math.min(contentMatch, 0.45);
  contentMatch = clamp01(contentMatch);

  let predicted = profile.meanRating + (contentMatch - 0.5) * 3.2;
  if (externalScore && externalScore.voteCount > 0) {
    const prior = externalScore.score / externalScore.scale * 5;
    const priorWeight = RECOMMENDER_CONFIG.externalPriorMaximum * (1 - profile.confidence);
    predicted = predicted * (1 - priorWeight) + prior * priorWeight;
  }
  predicted = clamp(Math.round(predicted * 2) / 2, 0.5, 5);

  const neighbourConfidence = clamp01(candidateNeighbours / 8);
  const confidence = profile.ratingCount === 0 ? 0 : clamp01(
    profile.confidence
      * (0.35 + candidate.completeness * 0.35 + candidateEvidence * 0.2 + neighbourConfidence * 0.1),
  );
  const score: ForYouScore = {
    predicted,
    match: Math.round(contentMatch * 100),
    confidence: Number(confidence.toFixed(2)),
    moodMatch: moodMatch === null ? undefined : Math.round(moodMatch * 100),
  };
  return {
    score,
    trace: {
      facets,
      facetWeights: profile.facetWeights,
      rawAffinity,
      islandAffinity: island?.value ?? null,
      islandId: island?.id ?? null,
      contentMatch,
      experienceMatch: axisMatch,
      moodMatch,
      reasons: [],
    },
    explanation: explanationFor(candidate, profile, index, mood?.label),
  };
}

