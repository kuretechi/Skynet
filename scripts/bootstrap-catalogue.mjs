const baseUrl = process.env.BOOTSTRAP_BASE_URL?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
if (!baseUrl || !secret) {
  console.error("Set BOOTSTRAP_BASE_URL and CRON_SECRET before running this script.");
  process.exit(1);
}

const numberFromEnv = (name, fallback, min, max) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(min, Math.min(Math.trunc(value), max)) : fallback;
};

let page = numberFromEnv("BOOTSTRAP_START_PAGE", 1, 1, 500);
const batches = numberFromEnv("BOOTSTRAP_BATCHES", 10, 1, 50);
const pages = numberFromEnv("BOOTSTRAP_PAGES_PER_BATCH", 1, 1, 2);
const derivedLimit = numberFromEnv("BOOTSTRAP_DERIVED_LIMIT", 50, 0, 100);
const target = numberFromEnv("BOOTSTRAP_TARGET", 1000, 1, 2000);
const ingest = process.env.BOOTSTRAP_INGEST !== "false";
const waitMs = numberFromEnv("BOOTSTRAP_WAIT_MS", 5_000, 1_500, 60_000);
let emptyBatches = 0;

for (let batch = 1; batch <= batches; batch += 1) {
  const response = await fetch(`${baseUrl}/api/maintenance/bootstrap`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ page, pages, derivedLimit, target, ingest }),
  });
  const report = await response.json();
  if (!response.ok) {
    console.error(`Batch ${batch} failed (${response.status})`, report);
    process.exitCode = 1;
    break;
  }

  console.log(JSON.stringify({ batch, ...report }));
  page = report.nextPage;
  emptyBatches = report.catalogueRemaining > 0 && report.catalogueAdded === 0 ? emptyBatches + 1 : 0;
  if (emptyBatches >= 3) {
    console.error("Stopped after three batches without new catalogue rows. Resume later from the next metadata page.");
    process.exitCode = 1;
    break;
  }
  if (report.catalogueRemaining === 0 && report.signaturesRemaining === 0 && report.experienceVectorsRemaining === 0) {
    console.log("Catalogue target and deterministic feature generation are complete.");
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

console.log(`Next metadata page: ${page}`);
