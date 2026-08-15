import { spawn } from "node:child_process";
import { schemaDatabaseUrl } from "./database-url.mjs";

const url = schemaDatabaseUrl(process.env.DATABASE_URL ?? "");

spawn("npx", ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
}).on("exit", (code) => process.exit(code ?? 1));
