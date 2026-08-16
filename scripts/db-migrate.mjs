import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { isPostgresUrl, schemaDatabaseUrl } from "./database-url.mjs";

/**
 * Schema changes for the deployed database go through migration files, so a
 * rename never reaches production as "drop the old column". SQLite development
 * databases keep using `db push`: the migration files are PostgreSQL SQL.
 *
 * A database created before this script existed already has every table but no
 * migration history, so the first migration is marked as applied instead of
 * being run against it.
 */
const ATTEMPTS = 6;
const BACKOFF_MS = 10_000;
const RETRYABLE = /EMAXCONNSESSION|max clients reached|too many connections|Timed out|P1001|P1017/i;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawUrl = process.env.DATABASE_URL ?? "";
const url = schemaDatabaseUrl(rawUrl);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(args) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn("npx", ["prisma", ...args], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: ["inherit", "pipe", "pipe"],
    });
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

async function withRetries(label, args) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const { code, output } = await run(args);
    if (code === 0) return;
    if (attempt === ATTEMPTS || !RETRYABLE.test(output)) {
      console.error(`${label} failed`);
      process.exit(code);
    }
    console.warn(`${label} attempt ${attempt} hit a busy database; retrying`);
    await sleep(BACKOFF_MS);
  }
}

async function retrying(label, task) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const message = String(error);
      if (attempt === ATTEMPTS || !RETRYABLE.test(message)) throw error;
      console.warn(`${label} attempt ${attempt} hit a busy database; retrying`);
      await sleep(BACKOFF_MS);
    }
  }
}

/** True when the database predates the migration history but already has tables. */
async function needsBaseline() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select to_regclass('public._prisma_migrations') is not null as has_history,
              to_regclass('public."User"') is not null as has_tables`,
    );
    return !rows[0].has_history && rows[0].has_tables;
  } finally {
    await client.end();
  }
}

function firstMigration() {
  const name = readdirSync(join(root, "prisma", "migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()[0];
  if (!name) {
    console.error("prisma/migrations holds no migration to baseline against");
    process.exit(1);
  }
  return name;
}

if (!isPostgresUrl(rawUrl)) {
  await withRetries("db push", ["db", "push", "--skip-generate", "--accept-data-loss"]);
} else {
  if (await retrying("baseline check", needsBaseline)) {
    const baseline = firstMigration();
    console.log(`marking ${baseline} as already applied to the existing database`);
    await withRetries("migrate resolve", ["migrate", "resolve", "--applied", baseline]);
  }
  await withRetries("migrate deploy", ["migrate", "deploy"]);
}
