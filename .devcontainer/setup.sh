#!/usr/bin/env bash
# Codespaces / devcontainer bootstrap: install deps, create a local .env and
# seed the SQLite database so `npm run dev` works immediately.
set -euo pipefail

npm install

if [ ! -f .env ]; then
  cp .env.example .env
  AUTH_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  # TMDB_API_KEY comes from a Codespaces secret when configured; empty falls back
  # to the built-in mock catalog.
  node - "$AUTH_SECRET" "${TMDB_API_KEY:-}" <<'NODE'
const fs = require("fs");
const [, , authSecret, tmdbKey] = process.argv;
const env = fs
  .readFileSync(".env", "utf8")
  .replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${authSecret}"`)
  .replace(/^TMDB_API_KEY=.*$/m, `TMDB_API_KEY="${tmdbKey}"`);
fs.writeFileSync(".env", env);
NODE
fi

npm run setup

echo "Ready. Start the app with: npm run dev"
