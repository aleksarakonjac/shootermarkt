import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { clubMemberships, competitions, disciplines, mixedTeamResults, nationalTeamMemberships, results, shooters } from "@shootermarkt/db/schema";

export class MergeError extends Error {}

export type MergePlan = {
  keep: typeof shooters.$inferSelect;
  drop: typeof shooters.$inferSelect;
  keepResults: number;
  dropResults: number;
  conflicts: number;
  previousLastNames: string[];
};

async function resultCount(shooterId: number) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(results).where(eq(results.shooterId, shooterId));
  return r.n;
}

/** Pregled spajanja bez upisa. Konflikt = oba strelca imaju rezultat u istom meču. */
export async function planMerge(keepId: number, dropId: number): Promise<MergePlan> {
  if (keepId === dropId) throw new MergeError("Isti strelac");
  const [keep] = await db.select().from(shooters).where(eq(shooters.id, keepId));
  const [drop] = await db.select().from(shooters).where(eq(shooters.id, dropId));
  if (!keep || !drop) throw new MergeError("Strelac ne postoji");

  const clash = await db.execute(sql`
    select d.id from results d join results k
      on k.shooter_id = ${keepId} and k.competition_id = d.competition_id and k.discipline_id = d.discipline_id
      and k.category is not distinct from d.category
      and k.competition_event_id is not distinct from d.competition_event_id
    where d.shooter_id = ${dropId}`);

  // Staro prezime duplikata postaje alias (ako se zaista razlikuje od trenutnog)
  const previousLastNames = [...new Set([
    ...(keep.previousLastNames ?? []),
    ...(drop.previousLastNames ?? []),
    ...(drop.lastName.toLowerCase() !== keep.lastName.toLowerCase() ? [drop.lastName] : []),
  ])];
  return { keep, drop, keepResults: await resultCount(keepId), dropResults: await resultCount(dropId), conflicts: clash.length, previousLastNames };
}

export const MERGE_FIELDS = ["firstName", "lastName", "birthDate", "gender", "nationality", "clubId", "apparatus", "avatarUrl", "issfId", "siusAthleteId"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeSide = "keep" | "drop";

export type MergeOptions = {
  /** Čija vrednost polja ostaje. Bez izbora (ili ako izabrana strana nema vrednost): keep, pa drop. */
  fields?: Partial<Record<MergeField, MergeSide>>;
  /** Rezultati (id-jevi oba strelca) koji ostaju; ostali se brišu. Bez ovoga: svi se prebacuju na keep. */
  resultIds?: number[];
};

const clashKey = (r: { competitionId: number; competitionEventId: number | null; disciplineId: number; category: string }) =>
  `${r.competitionId}|${r.competitionEventId ?? ""}|${r.disciplineId}|${r.category}`;

/**
 * Spaja `drop` u `keep`: rezultati se prebacuju, polja se biraju po strani (default: keep, pa drop),
 * izgubljeno prezime postaje alias, duplikat se briše. Jedna transakcija.
 * Sa `opts.resultIds` ostaju samo izabrani rezultati (dva izabrana za isti meč nisu dozvoljena).
 * Pozivalac preračunava formu za `keepId`.
 */
export async function mergeShooters(keepId: number, dropId: number, opts: MergeOptions = {}): Promise<MergePlan> {
  const plan = await planMerge(keepId, dropId);
  const { keep, drop } = plan;

  let keepIds: number[] | null = null;
  if (opts.resultIds) {
    const all = await db.select().from(results).where(inArray(results.shooterId, [keepId, dropId]));
    const chosen = new Set(opts.resultIds);
    const picked = all.filter((r) => chosen.has(r.id));
    if (picked.length !== chosen.size) throw new MergeError("Rezultat ne pripada ovim strelcima");
    const seen = new Set<string>();
    for (const r of picked) {
      if (seen.has(clashKey(r))) throw new MergeError("Dva izabrana rezultata su za isti meč — izaberi jedan");
      seen.add(clashKey(r));
    }
    keepIds = all.filter((r) => !chosen.has(r.id)).map((r) => r.id);
  } else if (plan.conflicts) {
    throw new MergeError(`Oba strelca imaju rezultat u istom meču (${plan.conflicts}) — reši ručno`);
  }

  const pick = <K extends MergeField>(f: K): (typeof keep)[K] => {
    const [first, second] = opts.fields?.[f] === "drop" ? [drop, keep] : [keep, drop];
    return first[f] ?? second[f];
  };
  const sideOf = (f: MergeField) => (opts.fields?.[f] === "drop" && drop[f] != null ? drop : keep[f] != null ? keep : drop);

  const lastName = pick("lastName");
  const birthSource = sideOf("birthDate");
  const aliases = [...new Set([...(keep.previousLastNames ?? []), ...(drop.previousLastNames ?? []), keep.lastName, drop.lastName]
    .filter((n) => n.toLowerCase() !== lastName.toLowerCase()))];

  await db.transaction(async (tx) => {
    if (keepIds?.length) await tx.delete(results).where(inArray(results.id, keepIds));
    await tx.update(results).set({ shooterId: keepId }).where(eq(results.shooterId, dropId));
    await tx.update(clubMemberships).set({ shooterId: keepId }).where(eq(clubMemberships.shooterId, dropId));
    await tx.update(nationalTeamMemberships).set({ shooterId: keepId }).where(eq(nationalTeamMemberships.shooterId, dropId));
    await tx.update(mixedTeamResults).set({ shooter1Id: keepId }).where(eq(mixedTeamResults.shooter1Id, dropId));
    await tx.update(mixedTeamResults).set({ shooter2Id: keepId }).where(eq(mixedTeamResults.shooter2Id, dropId));
    await tx.delete(shooters).where(eq(shooters.id, dropId)); // unique issf_id/sius id se oslobađaju pre dopune
    await tx.update(shooters).set({
      firstName: pick("firstName"),
      lastName,
      previousLastNames: aliases.length ? aliases : null,
      issfId: pick("issfId"),
      siusAthleteId: pick("siusAthleteId"),
      avatarUrl: pick("avatarUrl"),
      birthDate: pick("birthDate"),
      birthYear: birthSource.birthYear ?? keep.birthYear ?? drop.birthYear,
      gender: pick("gender"),
      apparatus: pick("apparatus"),
      clubId: pick("clubId"),
      nationality: pick("nationality"),
    }).where(eq(shooters.id, keepId));
  });
  return plan;
}

export type MergePreviewResult = {
  id: number;
  side: MergeSide;
  competition: string;
  date: string;
  discipline: string;
  category: string;
  qualTotal: string | null;
  qualRank: number | null;
  finalRank: number | null;
  source: string;
  /** id rezultata druge strane za isti meč (ili null) */
  clashWith: number | null;
};

/** Podaci za izbor u UI: oba strelca i svi njihovi rezultati, sa označenim istim mečevima. */
export async function mergePreview(keepId: number, dropId: number) {
  const plan = await planMerge(keepId, dropId);
  const rows = await db
    .select({
      id: results.id, shooterId: results.shooterId, competitionId: results.competitionId, competitionEventId: results.competitionEventId, disciplineId: results.disciplineId,
      category: results.category, competition: competitions.name, date: competitions.date, discipline: disciplines.code,
      qualTotal: results.qualTotal, qualRank: results.qualRank, finalRank: results.finalRank, source: results.source,
    })
    .from(results)
    .innerJoin(competitions, eq(competitions.id, results.competitionId))
    .innerJoin(disciplines, eq(disciplines.id, results.disciplineId))
    .where(inArray(results.shooterId, [keepId, dropId]))
    .orderBy(sql`${competitions.date} desc`, results.id);
  const byKey = new Map<string, { keep?: number; drop?: number }>();
  for (const r of rows) {
    const e = byKey.get(clashKey(r)) ?? {};
    e[r.shooterId === keepId ? "keep" : "drop"] = r.id;
    byKey.set(clashKey(r), e);
  }
  const list: MergePreviewResult[] = rows.map((r) => {
    const side: MergeSide = r.shooterId === keepId ? "keep" : "drop";
    const e = byKey.get(clashKey(r))!;
    return {
      id: r.id, side, competition: r.competition, date: String(r.date), discipline: r.discipline, category: r.category,
      qualTotal: r.qualTotal, qualRank: r.qualRank, finalRank: r.finalRank, source: r.source,
      clashWith: (side === "keep" ? e.drop : e.keep) ?? null,
    };
  });
  return { keep: plan.keep, drop: plan.drop, results: list };
}
