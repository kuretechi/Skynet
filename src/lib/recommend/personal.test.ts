import assert from "node:assert/strict";
import test from "node:test";
import type { AxisVector } from "@/lib/dna/axes";
import { buildFrequencyIndex } from "@/lib/signatures/similarity";
import type { ContentSignature, SignatureToken } from "@/lib/signatures/types";
import { buildPersonalTasteProfile, preferenceSignal, scorePersonalCandidate, type RatedTasteItem } from "./personal";
import { RECOMMENDER_CONFIG } from "./config";

const vector: AxisVector = { feel: 0.5, think: 0.5, immerse: 0.5, story: 0.5, sense: 0.5, pulse: 0.5, explore: 0.5, depth: 0.5 };
const zeroVector: AxisVector = { feel: 0, think: 0, immerse: 0, story: 0, sense: 0, pulse: 0, explore: 0, depth: 0 };
const oneVector: AxisVector = { feel: 1, think: 1, immerse: 1, story: 1, sense: 1, pulse: 1, explore: 1, depth: 1 };
const token = (key: string): SignatureToken => ({ key: `genre:${key}`, label: key });
const signature = (movieId: string, genre: string): ContentSignature => ({
  movieId,
  version: "test",
  metadataHash: movieId,
  theme: { genres: [token(genre)], keywords: [], forms: [] },
  creators: { writers: [], cast: [], companies: [] },
  context: { countries: [], languages: [] },
  format: { mediaType: "movie" },
  relations: {},
  completeness: 0.6,
});
const rated = (movieId: string, genre: string, score: number, masterpiece = false): RatedTasteItem => ({
  movieId, title: movieId, score, masterpiece, signature: signature(movieId, genre), vector,
});

test("masterpiece remains stronger than a five-star signal", () => {
  assert.ok(preferenceSignal(5, 3, true) > preferenceSignal(5, 3, false));
});

test("positive and negative history move similar candidates in opposite directions", () => {
  const profile = buildPersonalTasteProfile([
    rated("liked", "sf", 5),
    rated("disliked", "horror", 1),
    rated("neutral", "drama", 3),
  ]);
  const sf = signature("candidate-sf", "sf");
  const horror = signature("candidate-horror", "horror");
  const index = buildFrequencyIndex([...profile.signals.map((item) => item.signature), sf, horror]);
  const args = {
    profile, index, movieVector: vector, movieVectorConfidence: 0.5,
    dna: vector, dnaConfidence: 0.5, externalScore: null, mood: null,
  };
  const sfScore = scorePersonalCandidate({ candidate: sf, ...args });
  const horrorScore = scorePersonalCandidate({ candidate: horror, ...args });
  assert.ok(sfScore.score.match > horrorScore.score.match);
  assert.ok(sfScore.score.predicted > horrorScore.score.predicted);
});

test("the same inputs produce deterministic output", () => {
  const profile = buildPersonalTasteProfile([rated("liked", "sf", 5)]);
  const candidate = signature("candidate", "sf");
  const index = buildFrequencyIndex([...profile.signals.map((item) => item.signature), candidate]);
  const args = {
    candidate, profile, index, movieVector: vector, movieVectorConfidence: 0.5,
    dna: vector, dnaConfidence: 0.5, externalScore: null, mood: null,
  };
  assert.deepEqual(scorePersonalCandidate(args), scorePersonalCandidate(args));
});

test("sparse ratings stay shrunk toward neutral and low-confidence", () => {
  const sparse = buildPersonalTasteProfile([rated("one", "sf", 5)]);
  assert.ok(sparse.meanRating < 5 && sparse.meanRating > 3);
  assert.ok(sparse.confidence < 0.2);
});

test("distinct positive clusters remain separate Taste Islands", () => {
  const profile = buildPersonalTasteProfile([
    rated("sf-1", "sf", 5), rated("sf-2", "sf", 5), rated("sf-3", "sf", 5),
    rated("romance-1", "romance", 5), rated("romance-2", "romance", 5), rated("romance-3", "romance", 5),
  ]);
  assert.equal(profile.islands.length, 2);
  assert.deepEqual(profile.islands.map((island) => island.movieIds.length).sort(), [3, 3]);
});

test("FOR YOU is bounded and rounded to half-stars while MATCH stays a percentage", () => {
  const profile = buildPersonalTasteProfile([rated("liked", "sf", 5)]);
  const candidate = signature("candidate", "sf");
  const index = buildFrequencyIndex([...profile.signals.map((item) => item.signature), candidate]);
  const result = scorePersonalCandidate({
    candidate, profile, index, movieVector: vector, movieVectorConfidence: 1,
    dna: vector, dnaConfidence: 1, externalScore: { score: 10, scale: 10, voteCount: 100 }, mood: null,
  });
  assert.ok(result.score.predicted >= 0.5 && result.score.predicted <= 5);
  assert.equal(result.score.predicted * 2, Math.round(result.score.predicted * 2));
  assert.ok(result.score.match >= 0 && result.score.match <= 100);
});

test("confidence increases with relevant evidence", () => {
  const candidate = signature("candidate", "sf");
  const sparse = buildPersonalTasteProfile([rated("liked-1", "sf", 5)]);
  const rich = buildPersonalTasteProfile(Array.from({ length: 8 }, (_, index) => rated(`liked-${index}`, "sf", 5)));
  const score = (profile: ReturnType<typeof buildPersonalTasteProfile>) => scorePersonalCandidate({
    candidate,
    profile,
    index: buildFrequencyIndex([...profile.signals.map((item) => item.signature), candidate]),
    movieVector: vector,
    movieVectorConfidence: 1,
    dna: vector,
    dnaConfidence: 1,
    externalScore: null,
    mood: null,
  }).score.confidence;
  assert.ok(score(rich) > score(sparse));
});

test("the normal recommendation axis supplement obeys its hard cap", () => {
  const profile = buildPersonalTasteProfile([rated("liked", "sf", 5)]);
  const candidate = signature("candidate", "sf");
  const index = buildFrequencyIndex([...profile.signals.map((item) => item.signature), candidate]);
  const common = { candidate, profile, index, movieVectorConfidence: 1, dna: zeroVector, dnaConfidence: 1, externalScore: null, mood: null };
  const aligned = scorePersonalCandidate({ ...common, movieVector: zeroVector });
  const opposed = scorePersonalCandidate({ ...common, movieVector: oneVector });
  assert.ok(aligned.trace.contentMatch - opposed.trace.contentMatch <= RECOMMENDER_CONFIG.experienceWeightMaximum + 1e-9);
});

test("Mood Context affects only the request result, not the stored taste profile", () => {
  const profile = buildPersonalTasteProfile([rated("liked", "sf", 5)]);
  const before = structuredClone(profile);
  const candidate = signature("candidate", "sf");
  const index = buildFrequencyIndex([...profile.signals.map((item) => item.signature), candidate]);
  const base = scorePersonalCandidate({ candidate, profile, index, movieVector: oneVector, movieVectorConfidence: 1, dna: oneVector, dnaConfidence: 1, externalScore: null, mood: null });
  const mood = scorePersonalCandidate({ candidate, profile, index, movieVector: oneVector, movieVectorConfidence: 1, dna: oneVector, dnaConfidence: 1, externalScore: null, mood: { label: "静かに観たい", target: zeroVector } });
  assert.notEqual(base.score.match, mood.score.match);
  assert.deepEqual(profile, before);
});
