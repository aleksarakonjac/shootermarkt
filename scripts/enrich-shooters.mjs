#!/usr/bin/env node
/**
 * Enrich shooters: fetch ISSF profiles in parallel, update birthDate + apparatus.
 * Usage:
 *   node scripts/enrich-shooters.mjs [--concurrency 30] [--offset 0]
 *   node scripts/enrich-shooters.mjs --from-file scripts/null-apparatus.jsonl [--concurrency 30] [--offset 0]
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// Load env
const envFile = fileURLToPath(new URL("../.env.local", import.meta.url));
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const DB_URL   = env.DATABASE_URL?.replace(":5432/", ":6543/") ?? "";
const ISSF_API = "https://api.issf-sports.org/api/v01";

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? parseInt(args[i + 1]) : fallback;
}
function getStringArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const CONCURRENCY  = getArg("--concurrency", 30);
const START_OFFSET = getArg("--offset", 0);
const FROM_FILE    = getStringArg("--from-file", null);

// ── DB via postgres ────────────────────────────────────────────────────────────
const postgresPath = fileURLToPath(new URL(
  "../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js",
  import.meta.url
));
const { default: postgres } = await import(postgresPath);
const sql = postgres(DB_URL, { max: 5 });

// ── Apparatus inference ────────────────────────────────────────────────────────
const RIFLE_PREFIXES   = ["AR", "R3", "RFM", "RFW"];
const PISTOL_PREFIXES  = ["AP", "FP", "SP", "CFP", "STP", "RFP"];
const SHOTGUN_PREFIXES = ["TR", "SK", "DT", "FT"];

function inferApparatus(events) {
  if (!events?.trim()) return null;
  const codes = events.split(",").map((e) => e.trim().toUpperCase());
  const isRifle   = codes.some((c) => RIFLE_PREFIXES.some((p)   => c === p || c.startsWith(p)));
  const isPistol  = codes.some((c) => PISTOL_PREFIXES.some((p)  => c === p || c.startsWith(p)));
  const isShotgun = codes.some((c) => SHOTGUN_PREFIXES.some((p) => c === p || c.startsWith(p)));
  if (isRifle && isPistol) return "both";
  if (isRifle)   return "rifle";
  if (isPistol)  return "pistol";
  if (isShotgun) return "shotgun";
  return null;
}

// ── Fetch single ISSF profile ──────────────────────────────────────────────────
async function fetchProfile(issfId) {
  try {
    const res = await fetch(`${ISSF_API}/athletes/${issfId}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Load shooter list ─────────────────────────────────────────────────────────
let allShooters;
if (FROM_FILE) {
  const filePath = fileURLToPath(new URL(`../${FROM_FILE}`, import.meta.url));
  allShooters = readFileSync(filePath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  console.log(`Loaded ${allShooters.length} shooters from ${FROM_FILE}`);
} else {
  allShooters = await sql`
    SELECT id, issf_id
    FROM shooters
    WHERE issf_id IS NOT NULL
      AND (birth_date IS NULL OR apparatus IS NULL)
    ORDER BY id
    OFFSET ${START_OFFSET}
  `;
  console.log(`Found ${allShooters.length} shooters from DB (offset ${START_OFFSET})`);
}

// Apply offset when reading from file
if (FROM_FILE && START_OFFSET > 0) {
  allShooters = allShooters.slice(START_OFFSET);
  console.log(`Offset ${START_OFFSET} applied → ${allShooters.length} remaining`);
}

const total = allShooters.length;
console.log(`Concurrency: ${CONCURRENCY}`);

let processed = 0;
let enriched  = 0;
let failed    = 0;
const startTime = Date.now();

// Process in chunks of CONCURRENCY
for (let i = 0; i < total; i += CONCURRENCY) {
  const chunk = allShooters.slice(i, i + CONCURRENCY);

  await Promise.all(chunk.map(async (s) => {
    const issfId = s.issfId ?? s.issf_id;
    const profile = await fetchProfile(issfId);
    processed++;

    if (!profile) { failed++; return; }

    const birthday  = profile.birthday;
    const events    = profile.events;
    const fullDate  = birthday ? birthday.slice(0, 10) : null;
    const birthYear = fullDate ? new Date(fullDate).getFullYear() : null;
    const apparatus = inferApparatus(events);

    const updates = [];
    const values  = [];
    if (fullDate && birthYear && !isNaN(birthYear)) {
      updates.push(`birth_date = $${values.push(fullDate)}`, `birth_year = $${values.push(birthYear)}`);
    }
    if (apparatus) {
      updates.push(`apparatus = $${values.push(apparatus)}`);
    }

    if (updates.length > 0) {
      values.push(s.id);
      await sql.unsafe(
        `UPDATE shooters SET ${updates.join(", ")} WHERE id = $${values.length}`,
        values
      );
      enriched++;
    }
  }));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const rate    = (processed / ((Date.now() - startTime) / 1000)).toFixed(1);
  const eta     = ((total - processed) / parseFloat(rate)).toFixed(0);
  process.stdout.write(
    `\r[${elapsed}s] ${processed}/${total} processed · ${enriched} updated · ${failed} failed · ${rate}/s · ETA ${eta}s   `
  );
}

console.log(`\nDone. ${enriched} enriched, ${failed} failed, ${processed} total.`);
await sql.end();
