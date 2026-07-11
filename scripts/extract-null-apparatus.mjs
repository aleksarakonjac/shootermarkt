#!/usr/bin/env node
/**
 * Writes all shooters with issf_id and apparatus IS NULL to a JSONL file.
 * Usage: node scripts/extract-null-apparatus.mjs [--out scripts/null-apparatus.jsonl]
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import postgres from "postgres";

const envFile = fileURLToPath(new URL("../.env.local", import.meta.url));
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const args = process.argv.slice(2);
function getStringArg(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const OUT = getStringArg("--out", "scripts/null-apparatus.jsonl");

const sql = postgres(env.DATABASE_URL?.replace(":5432/", ":6543/") ?? "", { max: 1 });

const rows = await sql`
  SELECT id, issf_id
  FROM shooters
  WHERE issf_id IS NOT NULL
    AND apparatus IS NULL
  ORDER BY id
`;

await sql.end();

const lines = rows.map((r) => JSON.stringify({ id: r.id, issfId: r.issf_id }));
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`Wrote ${rows.length} shooters to ${OUT}`);
