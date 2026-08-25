import assert from "node:assert/strict";
import { test } from "node:test";
import { selectAiProvider } from "./provider-selection.ts";

test("selects Gemini when explicitly configured with a key", () => {
  assert.equal(selectAiProvider({
    AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "test-gemini-key",
    OPENAI_API_KEY: "test-openai-key",
  }), "gemini");
});

test("does not silently use another provider when the selected key is missing", () => {
  assert.equal(selectAiProvider({
    AI_PROVIDER: "gemini",
    OPENAI_API_KEY: "test-openai-key",
  }), null);
});

test("prefers Gemini during automatic provider selection", () => {
  assert.equal(selectAiProvider({
    GEMINI_API_KEY: "test-gemini-key",
    OPENAI_API_KEY: "test-openai-key",
  }), "gemini");
});

