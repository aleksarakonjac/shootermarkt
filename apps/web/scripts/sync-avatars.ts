/**
 * sync-avatars.ts
 * Prolazi kroz sve strelce sa issfId ali bez avatar_url,
 * fetchuje portrait sa ISSF API-ja, uploaduje WebP u Supabase Storage.
 *
 * Pokretanje:
 *   npx tsx --env-file=.env.local scripts/sync-avatars.ts
 *
 * Opcije:
 *   --dry-run     Samo broji, ne uploaduje
 *   --limit N     Obradi max N strelaca (za testiranje)
 *   --concurrency N  Paralelnih fetchova (default 5)
 */

import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { isNull, eq } from "drizzle-orm";
import { uploadAvatarFromUrl, NoAvatarError } from "@shootermarkt/db/upload-avatar";

const ISSF_API = "https://api.issf-sports.org/api/v01";
const DELAY_MS = 150; // između batch-eva da ne hammerjemo ISSF

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i !== -1 ? parseInt(args[i + 1]) : Infinity; })();
const CONCURRENCY = (() => { const i = args.indexOf("--concurrency"); return i !== -1 ? parseInt(args[i + 1]) : 5; })();

async function getPortraitUrl(issfId: string): Promise<string | null> {
  const res = await fetch(`${ISSF_API}/athletes/${issfId}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.portraitUrl ?? null;
}

async function processChunk(chunk: { id: number; issfId: string }[], stats: Stats) {
  // Phase 1: fetch portrait URLs + upload to Storage (parallel)
  const uploads = await Promise.allSettled(
    chunk.map(async ({ id, issfId }) => {
      const portraitUrl = await getPortraitUrl(issfId);
      if (!portraitUrl) return { id, issfId, result: "no_url" as const };

      if (DRY_RUN) {
        const isPlaceholder = portraitUrl.includes("result.issf-sports.info");
        return { id, issfId, result: isPlaceholder ? "placeholder" as const : "would_upload" as const };
      }

      const avatarUrl = await uploadAvatarFromUrl(issfId, portraitUrl);
      return { id, issfId, result: "uploaded" as const, avatarUrl };
    })
  );

  // Phase 2: DB updates — sequential to avoid pool exhaustion
  for (const settled of uploads) {
    if (settled.status === "rejected") {
      const e = settled.reason as Error;
      if (e instanceof NoAvatarError) {
        stats.placeholder++;
      } else {
        stats.errors++;
        if (stats.errors <= 10) console.error(`\n  ✗ upload error:`, e.message);
      }
      continue;
    }

    const val = settled.value;
    switch (val.result) {
      case "no_url":        stats.noPortraitUrl++; break;
      case "placeholder":   stats.placeholder++;   break;
      case "would_upload":  stats.wouldUpload++;   break;
      case "uploaded":
        try {
          await db.update(shooters).set({ avatarUrl: val.avatarUrl }).where(eq(shooters.id, val.id));
          stats.uploaded++;
        } catch (e) {
          stats.errors++;
          if (stats.errors <= 10) console.error(`\n  ✗ DB update ${val.issfId}:`, (e as Error).message, (e as Error).cause);
        }
        break;
    }
  }
}

interface Stats {
  uploaded: number;
  placeholder: number;
  noPortraitUrl: number;
  wouldUpload: number;
  errors: number;
}

async function main() {
  console.log(`\n=== sync-avatars ${DRY_RUN ? "[DRY RUN] " : ""}===`);

  const rows = await db
    .select({ id: shooters.id, issfId: shooters.issfId })
    .from(shooters)
    .where(
      isNull(shooters.avatarUrl)
    )
    .then((r) => r.filter((s): s is { id: number; issfId: string } => !!s.issfId));

  const total = Math.min(rows.length, isFinite(LIMIT) ? LIMIT : rows.length);
  const toProcess = rows.slice(0, total);

  console.log(`Strelaca sa issfId bez avatara: ${rows.length}`);
  if (isFinite(LIMIT)) console.log(`Limit: ${LIMIT}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  const stats: Stats = { uploaded: 0, placeholder: 0, noPortraitUrl: 0, wouldUpload: 0, errors: 0 };
  let done = 0;

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const chunk = toProcess.slice(i, i + CONCURRENCY);
    await processChunk(chunk, stats);
    done += chunk.length;

    const pct = ((done / total) * 100).toFixed(1);
    process.stdout.write(
      `\r[${pct}%] ${done}/${total}  ` +
      `✓${DRY_RUN ? stats.wouldUpload : stats.uploaded} ` +
      `⊘${stats.placeholder} ` +
      `∅${stats.noPortraitUrl} ` +
      `✗${stats.errors}   `
    );

    if (i + CONCURRENCY < toProcess.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log("\n");
  console.log("=== Rezultat ===");
  if (DRY_RUN) {
    console.log(`  Bi uploadovano:   ${stats.wouldUpload}`);
  } else {
    console.log(`  Uploadovano:      ${stats.uploaded}`);
  }
  console.log(`  Placeholder:      ${stats.placeholder}`);
  console.log(`  Bez portrait URL: ${stats.noPortraitUrl}`);
  console.log(`  Greške:           ${stats.errors}`);
  console.log(`  Ukupno obrađeno:  ${done}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
