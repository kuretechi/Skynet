import assert from "node:assert/strict";
import test from "node:test";

import { toggleRating } from "./toggle.ts";

test("selecting the current rating removes it", () => {
  assert.equal(toggleRating(4, 4), null);
});

test("selecting a different rating replaces it", () => {
  assert.equal(toggleRating(4, 4.5), 4.5);
});

test("selecting a rating when none exists creates it", () => {
  assert.equal(toggleRating(null, 3.5), 3.5);
});
