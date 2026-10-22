// Spaja duplikat strelca u glavni profil: rezultate prebacuje na --keep, staro prezime
// duplikata upisuje u previous_last_names, duplikat briše. Dry-run po defaultu; upis tek sa --commit.
//   pnpm --filter @shootermarkt/web db:merge-shooters -- --find Havran Stojadinovic
//   pnpm --filter @shootermarkt/web db:merge-shooters -- --keep 12 --drop 34 [--commit]
import { ilike, or, eq, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { results, shooters } from "@shootermarkt/db/schema";
import { mergeShooters, planMerge } from "@/lib/merge-shooters";
import { recomputeFormaCache } from "@/lib/forma-cache";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const arg = (name: string) => args[args.indexOf(name) + 1];

async function count(shooterId: number) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(results).where(eq(results.shooterId, shooterId));
  return r.n;
}

async function find(terms: string[]) {
  const rows = await db.select().from(shooters).where(or(...terms.map((t) => ilike(shooters.lastName, `${t}%`))));
  for (const s of rows) {
    console.log(`#${s.id} ${s.lastName} ${s.firstName} nat=${s.nationality} club=${s.clubId} issf=${s.issfId} sius=${s.siusAthleteId} prev=${JSON.stringify(s.previousLastNames)} results=${await count(s.id)}`);
  }
}

async function merge(keepId: number, dropId: number) {
  const plan = await planMerge(keepId, dropId);
  console.log(`keep: #${plan.keep.id} ${plan.keep.lastName} ${plan.keep.firstName} (${plan.keepResults} rez.)`);
  console.log(`drop: #${plan.drop.id} ${plan.drop.lastName} ${plan.drop.firstName} (${plan.dropResults} rez.)`);
  console.log(`konflikti: ${plan.conflicts}; previous_last_names -> ${JSON.stringify(plan.previousLastNames)}`);
  if (!commit) { console.log("dry-run; dodaj --commit"); return; }
  await mergeShooters(keepId, dropId);
  await recomputeFormaCache([keepId]);
  console.log("spojeno, forma preračunata.");
}

async function main() {
  if (args.includes("--find")) return find(args.slice(args.indexOf("--find") + 1).filter((a) => !a.startsWith("--")));
  const keepId = parseInt(arg("--keep"));
  const dropId = parseInt(arg("--drop"));
  if (isNaN(keepId) || isNaN(dropId)) throw new Error("Treba --keep <id> --drop <id> ili --find <prezime...>");
  await merge(keepId, dropId);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
