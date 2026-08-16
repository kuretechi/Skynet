import { spawn } from "node:child_process";
import { mkdirSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPostgresUrl } from "./database-url.mjs";

/**
 * Writes the next migration file. Development runs on SQLite while the
 * migration files are PostgreSQL SQL, so the diff is taken against an empty
 * PostgreSQL database (`SHADOW_DATABASE_URL`, e.g. a throwaway container)
 * rather than against the local database.
 *
 *   SHADOW_DATABASE_URL=postgresql://... npm run db:migrate:new -- add_room_tags
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];
const shadow = process.env.SHADOW_DATABASE_URL ?? "";

if (!name) {
  console.error("usage: npm run db:migrate:new -- <migration_name>");
  process.exit(1);
}
if (!isPostgresUrl(shadow)) {
  console.error("SHADOW_DATABASE_URL must point at an empty PostgreSQL database");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const dir = join(root, "prisma", "migrations", `${stamp}_${name}`);

const sql = await new Promise((resolve) => {
  let output = "";
  const child = spawn(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-schema-datamodel",
      "prisma/schema.generated.prisma",
      "--shadow-database-url",
      shadow,
      "--script",
    ],
    { cwd: root, env: { ...process.env, DATABASE_URL: shadow }, stdio: ["inherit", "pipe", "inherit"] },
  );
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.on("exit", (code) => resolve(code === 0 ? output : null));
});

if (sql === null) process.exit(1);
if (sql.trim() === "" || /^-- This is an empty migration/m.test(sql)) {
  console.log("schema matches the existing migrations; nothing to write");
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
try {
  writeFileSync(join(dir, "migration.sql"), sql);
} catch (error) {
  rmdirSync(dir);
  throw error;
}
console.log(`wrote ${dir}/migration.sql`);
