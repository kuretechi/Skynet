import assert from "node:assert/strict";
import test from "node:test";
import { buildFrequencyIndex, signatureSimilarity } from "./similarity";
import type { ContentSignature, SignatureToken } from "./types";

const token = (key: string, label = key): SignatureToken => ({ key, label });
const signature = (movieId: string, genres: string[], keywords: string[] = []): ContentSignature => ({
  movieId,
  version: "test",
  metadataHash: movieId,
  theme: {
    genres: genres.map((value) => token(`genre:${value}`, value)),
    keywords: keywords.map((value) => token(`keyword:${value}`, value)),
    forms: [],
  },
  creators: { writers: [], cast: [], companies: [] },
  context: { countries: [], languages: [] },
  format: { mediaType: "movie" },
  relations: {},
  completeness: 0.6,
});

test("factual overlap produces a stronger signature match", () => {
  const target = signature("target", ["sf", "drama"], ["space", "time"]);
  const close = signature("close", ["sf", "drama"], ["space"]);
  const far = signature("far", ["comedy"], ["wedding"]);
  const index = buildFrequencyIndex([target, close, far]);
  assert.ok(signatureSimilarity(target, close, index).overall > signatureSimilarity(target, far, index).overall);
});

test("missing facets lower evidence instead of becoming a mismatch", () => {
  const target = signature("target", ["sf"]);
  const missing = signature("missing", []);
  const index = buildFrequencyIndex([target, missing]);
  const result = signatureSimilarity(target, missing, index);
  assert.equal(result.facets.theme.value, null);
  assert.equal(result.facets.theme.evidence, 0);
});

