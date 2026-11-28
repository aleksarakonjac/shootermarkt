import { eq, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { matchAthlete, type AgeContext } from "@shootermarkt/db/name-match";

/** Broj rezultata strelca — za matchShooter (dvosmislena varijanta imena → aktivan strelac). */
// Sirov SQL: Drizzle u select listi ne kvalifikuje kolone, pa bi "id" u podupitu značio results.id.
export const shooterResultCount = sql<number>`(select count(*)::int from results r where r.shooter_id = "shooters"."id")`;

export type ShooterDraft = {
  firstName: string; lastName: string; teamNoc: string; birthYear?: number | null;
  gender?: "M" | "F" | null; apparatus?: string | null; clubId?: number | null; issfId?: string | null;
};

/** Svi strelci, učitani jednom po uvozu; `ensureShooter` u njih dopisuje nove da se isti ne napravi dvaput. */
export async function loadKnownShooters() {
  const all = await db.select({
    id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName,
    previousLastNames: shooters.previousLastNames, previousFirstNames: shooters.previousFirstNames,
    nationality: shooters.nationality, clubId: shooters.clubId,
    birthYear: shooters.birthYear, apparatus: shooters.apparatus, issfId: shooters.issfId,
    resultCount: shooterResultCount,
  }).from(shooters);
  return { all, byIssfId: new Map(all.filter((s) => s.issfId).map((s) => [s.issfId!, s])) };
}

export type KnownShooters = Awaited<ReturnType<typeof loadKnownShooters>>;

/** Postojeći strelac (dopunjen praznim poljima iz `draft`) ili novi neverifikovan; vraća njegov id. */
export async function ensureShooter(draft: ShooterDraft, known: KnownShooters, age?: AgeContext): Promise<number> {
  // ISSF ID odlučuje; po imenu se ne uzima strelac sa drugim ID-em ni prestar za kategoriju
  const issfId = draft.issfId ?? null;
  const clubId = draft.clubId ?? null;
  const match = matchAthlete(issfId, draft.firstName, draft.lastName, draft.teamNoc || null, known.all, { age });
  const existing = match.kind === "exact" ? known.all.find((shooter) => shooter.id === match.id) : undefined;
  if (existing) {
    const patch: Partial<typeof shooters.$inferInsert> = {};
    // Bez ID-a na profilu pogodak je po imenu (pušta SRB/AIN/praznu naciju) → issfId tek uz istu naciju
    if (issfId && !existing.issfId && existing.nationality === draft.teamNoc) {
      patch.issfId = issfId;
      existing.issfId = issfId;
      known.byIssfId.set(issfId, existing);
    }
    if (!existing.clubId && clubId) patch.clubId = clubId;
    if (!existing.birthYear && draft.birthYear) patch.birthYear = draft.birthYear;
    if (!existing.apparatus && draft.apparatus) patch.apparatus = draft.apparatus;
    if (Object.keys(patch).length) await db.update(shooters).set(patch).where(eq(shooters.id, existing.id));
    return existing.id;
  }
  const [created] = await db.insert(shooters).values({
    firstName: draft.firstName, lastName: draft.lastName, nationality: draft.teamNoc || null,
    birthYear: draft.birthYear ?? null, gender: draft.gender ?? null,
    apparatus: draft.apparatus ?? null, clubId,
    createdBySelf: false, verified: false, issfId,
  }).returning({ id: shooters.id });
  const added = {
    id: created.id, firstName: draft.firstName, lastName: draft.lastName,
    previousLastNames: null, previousFirstNames: null,
    nationality: draft.teamNoc || null, clubId,
    birthYear: draft.birthYear ?? null, apparatus: draft.apparatus ?? null, issfId,
    resultCount: 1,
  };
  known.all.push(added);
  if (issfId) known.byIssfId.set(issfId, added);
  return created.id;
}
