import { RECOMMENDER_CONFIG } from "@/lib/recommend/config";
import { FACETS, type ContentSignature, type Facet, type FacetSimilarity, type FacetWeights, type SignatureSimilarity, type SignatureToken } from "./types";

export type FrequencyIndex = {
  documents: number;
  counts: Map<string, number>;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const tokenKeys = (tokens: SignatureToken[]) => new Set(tokens.map((item) => item.key));
const intersection = (a: SignatureToken[], b: SignatureToken[]) => {
  const right = new Set(b.map((item) => item.key));
  return a.filter((item) => right.has(item.key));
};

export function buildFrequencyIndex(signatures: Iterable<ContentSignature>): FrequencyIndex {
  const rows = [...signatures];
  const counts = new Map<string, number>();
  for (const signature of rows) {
    const keys = new Set([
      ...signature.theme.genres.map((item) => item.key),
      ...signature.theme.keywords.map((item) => item.key),
      ...signature.theme.forms.map((item) => item.key),
    ]);
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { documents: Math.max(1, rows.length), counts };
}

const idf = (key: string, index: FrequencyIndex) =>
  Math.log((index.documents + 1) / ((index.counts.get(key) ?? 0) + 1)) + 1;

const weightedJaccard = (a: SignatureToken[], b: SignatureToken[], index: FrequencyIndex) => {
  if (a.length === 0 || b.length === 0) return null;
  const left = tokenKeys(a);
  const right = tokenKeys(b);
  const union = new Set([...left, ...right]);
  let numerator = 0;
  let denominator = 0;
  for (const key of union) {
    const weight = idf(key, index);
    denominator += weight;
    if (left.has(key) && right.has(key)) numerator += weight;
  }
  return denominator > 0 ? numerator / denominator : null;
};

const weightedCosine = (a: SignatureToken[], b: SignatureToken[], index: FrequencyIndex) => {
  if (a.length === 0 || b.length === 0) return null;
  const left = tokenKeys(a);
  const right = tokenKeys(b);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const key of left) {
    const weight = idf(key, index);
    leftNorm += weight ** 2;
    if (right.has(key)) dot += weight ** 2;
  }
  for (const key of right) rightNorm += idf(key, index) ** 2;
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : null;
};

const averageAvailable = (values: (number | null)[]) => {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
};

const overlap = (a: SignatureToken[], b: SignatureToken[]) => {
  if (a.length === 0 || b.length === 0) return null;
  const shared = intersection(a, b).length;
  return shared / Math.sqrt(a.length * b.length);
};

const exact = (a?: SignatureToken, b?: SignatureToken) => {
  if (!a || !b) return null;
  return a.key === b.key ? 1 : 0;
};

const labelled = (prefix: string, values: SignatureToken[], max = 2) =>
  values.slice(0, max).map((item) => `${prefix}${item.label}`);

function themeSimilarity(a: ContentSignature, b: ContentSignature, index: FrequencyIndex): FacetSimilarity {
  const genres = weightedJaccard(a.theme.genres, b.theme.genres, index);
  const keywords = weightedCosine(a.theme.keywords, b.theme.keywords, index);
  const forms = weightedJaccard(a.theme.forms, b.theme.forms, index);
  const value = averageAvailable([genres, keywords, forms]);
  return {
    value,
    evidence: [genres, keywords, forms].filter((item) => item !== null).length / 3,
    reasons: [
      ...labelled("ジャンル: ", intersection(a.theme.genres, b.theme.genres)),
      ...labelled("要素: ", intersection(a.theme.keywords, b.theme.keywords)),
    ],
  };
}

function creatorSimilarity(a: ContentSignature, b: ContentSignature): FacetSimilarity {
  const director = exact(a.creators.director, b.creators.director);
  const writers = overlap(a.creators.writers, b.creators.writers);
  const cast = overlap(a.creators.cast, b.creators.cast);
  const companies = overlap(a.creators.companies, b.creators.companies);
  const weighted = [
    director === null ? null : { value: director, weight: 0.4 },
    writers === null ? null : { value: writers, weight: 0.25 },
    cast === null ? null : { value: cast, weight: 0.2 },
    companies === null ? null : { value: companies, weight: 0.15 },
  ].filter((item): item is { value: number; weight: number } => item !== null);
  const denominator = weighted.reduce((sum, item) => sum + item.weight, 0);
  return {
    value: denominator ? weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / denominator : null,
    evidence: denominator,
    reasons: [
      ...(director === 1 && a.creators.director ? [`監督: ${a.creators.director.label}`] : []),
      ...labelled("脚本: ", intersection(a.creators.writers, b.creators.writers), 1),
      ...labelled("出演: ", intersection(a.creators.cast, b.creators.cast), 1),
    ],
  };
}

function contextSimilarity(a: ContentSignature, b: ContentSignature): FacetSimilarity {
  const year = a.context.year && b.context.year
    ? clamp01(1 - Math.abs(a.context.year - b.context.year) / 40)
    : null;
  const countries = overlap(a.context.countries, b.context.countries);
  const languages = overlap(a.context.languages, b.context.languages);
  const value = averageAvailable([year, countries, languages]);
  return {
    value,
    evidence: [year, countries, languages].filter((item) => item !== null).length / 3,
    reasons: [
      ...(year !== null && year > 0.75 && a.context.year ? [`年代: ${Math.floor(a.context.year / 10) * 10}年代付近`] : []),
      ...labelled("制作国: ", intersection(a.context.countries, b.context.countries), 1),
      ...labelled("原語: ", intersection(a.context.languages, b.context.languages), 1),
    ],
  };
}

function formatSimilarity(a: ContentSignature, b: ContentSignature): FacetSimilarity {
  const runtime = a.format.runtime && b.format.runtime
    ? clamp01(1 - Math.abs(a.format.runtime - b.format.runtime) / 120)
    : null;
  const mediaType = a.format.mediaType && b.format.mediaType ? Number(a.format.mediaType === b.format.mediaType) : null;
  return {
    value: averageAvailable([runtime, mediaType]),
    evidence: [runtime, mediaType].filter((item) => item !== null).length / 2,
    reasons: runtime !== null && runtime > 0.8 ? ["上映時間が近い"] : [],
  };
}

function relationSimilarity(a: ContentSignature, b: ContentSignature): FacetSimilarity {
  const collection = exact(a.relations.collection, b.relations.collection);
  return {
    value: collection,
    evidence: collection === null ? 0 : 1,
    reasons: collection === 1 && a.relations.collection ? [`シリーズ: ${a.relations.collection.label}`] : [],
  };
}

export function signatureSimilarity(
  a: ContentSignature,
  b: ContentSignature,
  index: FrequencyIndex,
  weights: FacetWeights = RECOMMENDER_CONFIG.facetPriors,
): SignatureSimilarity {
  const facets: Record<Facet, FacetSimilarity> = {
    theme: themeSimilarity(a, b, index),
    creators: creatorSimilarity(a, b),
    context: contextSimilarity(a, b),
    format: formatSimilarity(a, b),
    relations: relationSimilarity(a, b),
  };
  let numerator = 0;
  let denominator = 0;
  let evidence = 0;
  for (const facet of FACETS) {
    const result = facets[facet];
    if (result.value === null) continue;
    const weight = weights[facet] * Math.max(0.2, result.evidence);
    numerator += result.value * weight;
    denominator += weight;
    evidence += result.evidence * weights[facet];
  }
  return {
    facets,
    overall: denominator ? numerator / denominator : 0,
    evidence: clamp01(evidence),
    reasons: FACETS.flatMap((facet) => facets[facet].reasons).slice(0, 4),
  };
}

