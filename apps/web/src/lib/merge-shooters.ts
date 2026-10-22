import { eq, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { clubMemberships, mixedTeamResults, nationalTeamMemberships, results, shooters } from "@shootermarkt/db/schema";

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
    where d.shooter_id = ${dropId}`);

  // Staro prezime duplikata postaje alias (ako se zaista razlikuje od trenutnog)
  const previousLastNames = [...new Set([
    ...(keep.previousLastNames ?? []),
    ...(drop.previousLastNames ?? []),
    ...(drop.lastName.toLowerCase() !== keep.lastName.toLowerCase() ? [drop.lastName] : []),
  ])];
  return { keep, drop, keepResults: await resultCount(keepId), dropResults: await resultCount(dropId), conflicts: clash.length, previousLastNames };
}

/**
 * Spaja `drop` u `keep`: rezultati se prebacuju, issfId/avatar/rođendan se dopunjuju samo
 * ako ih keep nema, staro prezime postaje alias, duplikat se briše. Jedna transakcija.
 * Pozivalac preračunava formu za `keepId`.
 */
export async function mergeShooters(keepId: number, dropId: number): Promise<MergePlan> {
  const plan = await planMerge(keepId, dropId);
  if (plan.conflicts) throw new MergeError(`Oba strelca imaju rezultat u istom meču (${plan.conflicts}) — reši ručno`);
  const { keep, drop } = plan;

  await db.transaction(async (tx) => {
    await tx.update(results).set({ shooterId: keepId }).where(eq(results.shooterId, dropId));
    await tx.update(clubMemberships).set({ shooterId: keepId }).where(eq(clubMemberships.shooterId, dropId));
    await tx.update(nationalTeamMemberships).set({ shooterId: keepId }).where(eq(nationalTeamMemberships.shooterId, dropId));
    await tx.update(mixedTeamResults).set({ shooter1Id: keepId }).where(eq(mixedTeamResults.shooter1Id, dropId));
    await tx.update(mixedTeamResults).set({ shooter2Id: keepId }).where(eq(mixedTeamResults.shooter2Id, dropId));
    await tx.delete(shooters).where(eq(shooters.id, dropId)); // unique issf_id/sius id se oslobađaju pre dopune
    await tx.update(shooters).set({
      previousLastNames: plan.previousLastNames.length ? plan.previousLastNames : null,
      issfId: keep.issfId ?? drop.issfId,
      siusAthleteId: keep.siusAthleteId ?? drop.siusAthleteId,
      avatarUrl: keep.avatarUrl ?? drop.avatarUrl,
      birthDate: keep.birthDate ?? drop.birthDate,
      birthYear: keep.birthYear ?? drop.birthYear,
      gender: keep.gender ?? drop.gender,
      apparatus: keep.apparatus ?? drop.apparatus,
      clubId: keep.clubId ?? drop.clubId,
      nationality: keep.nationality ?? drop.nationality,
    }).where(eq(shooters.id, keepId));
  });
  return plan;
}
