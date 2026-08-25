import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { schemaDatabaseUrl } from "./database-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");

/**
 * Supabase's session pooler (port 5432) only accepts 15 clients at a time and
 * the running app plus any concurrent deploy can hold all of them, so a build
 * that pushes the schema loses the race and fails the whole deploy. The push is
 * idempotent, so retry it for a while before giving up.
 *
 * Builds are non-interactive, so data loss warnings have to be accepted up
 * front or prisma aborts instead of prompting.
 */
const ATTEMPTS = 6;
const BACKOFF_MS = 10_000;
const RETRYABLE = /EMAXCONNSESSION|max clients reached|too many connections|Timed out|P1001|P1017/i;

const url = schemaDatabaseUrl(process.env.DATABASE_URL ?? "");
const childEnv = url ? { ...process.env, DATABASE_URL: url } : process.env;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function push() {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn(
      process.execPath,
      [prismaCli, "db", "push", "--skip-generate", "--accept-data-loss"],
      {
        env: childEnv,
        stdio: ["inherit", "pipe", "pipe"],
      },
    );
    const capture = (stream, sink) =>
      stream.on("data", (chunk) => {
        output += chunk;
        sink.write(chunk);
      });
    capture(child.stdout, process.stdout);
    capture(child.stderr, process.stderr);
    child.on("exit", (code) => resolve({ code: code ?? 1, output }));
  });
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const { code, output } = await push();
  if (code === 0) process.exit(0);
  if (attempt === ATTEMPTS || !RETRYABLE.test(output)) process.exit(code);
  const wait = BACKOFF_MS * attempt;
  console.warn(
    `prisma db push failed on a busy connection pool, retrying in ${wait / 1000}s ` +
      `(attempt ${attempt + 1}/${ATTEMPTS})`,
  );
  await sleep(wait);
}
