import { and, eq, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { clubs, competitionEvents, competitions, disciplines, results, shooters } from "@shootermarkt/db/schema";
import { ensureCompetitionEvent } from "@/lib/competition-events";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { eventTypeFromName, groupsFromName } from "@/lib/competition-filters";
import { refreshDisciplineGroups } from "@/lib/discipline-groups";
import { ensureShooter, loadKnownShooters } from "@/lib/ensure-shooter";
import { asIssfId } from "@shootermarkt/db/name-match";
import { DISCIPLINE_META, type CommitPayload, type ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { changedColumns, changedParts, resultColumns, upsertedResult, type ImportStatus } from "@/lib/import-diff";

export class CommitValidationError extends Error {}

export type CommitResult = {
  /** Upisani redovi: novi + izmenjeni. */
  inserted: number;
  /** Od upisanih, koliko ih je već postojalo sa drugim vrednostima. */
  updated: number;
  /** Već uneti bez razlike — nisu ponovo upisivani. */
  unchanged: number;
  skipped: number;
  errors: string[];
  competitionId: number;
};

async function addCompetitionTags(competitionId: number, tags: string[]) {
  if (!tags.length) return;
  const tagArray = sql`ARRAY[${sql.join(tags.map((tag) => sql`${tag}`), sql`, `)}]::varchar[]`;
  await db.update(competitions).set({
    tags: sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, ${tagArray})))`,
  }).where(eq(competitions.id, competitionId));
}

/** Shallow per-stage merge so a re-import of one stage never wipes another stage's marks. */
const mergeRemarkDetails = sql`coalesce(${results.remarkDetails} || excluded.remark_details, excluded.remark_details, ${results.remarkDetails})`;

const resultKey = (shooterId: number, eventId: number | null, disciplineId: number, category: string) =>
  `${shooterId}|${eventId ?? ""}|${disciplineId}|${category}`;

/** Postojeći rezultati i mečevi takmičenja, za poređenje pre upisa. */
async function loadExisting(competitionId: number) {
  const [rows, events] = await Promise.all([
    db.select().from(results).where(eq(results.competitionId, competitionId)),
    db.select({ id: competitionEvents.id, name: competitionEvents.name }).from(competitionEvents).where(eq(competitionEvents.competitionId, competitionId)),
  ]);
  return {
    results: new Map<string, Record<string, unknown>>(rows.map((r) => [resultKey(r.shooterId, r.competitionEventId, r.disciplineId, r.category), r])),
    eventIds: new Map(events.map((e) => [e.name, e.id])),
  };
}

/** Šta bi commit uradio sa svakim redom, bez ijednog upisa. Red bez strelca je nov. */
export async function previewImportRows(competitionId: number, rows: ReviewRow[]): Promise<{ status: ImportStatus; changes: string[] }[]> {
  const existing = await loadExisting(competitionId);
  const disciplineMap = Object.fromEntries((await db.select().from(disciplines)).map((d) => [d.code, d.id]));
  return rows.map((row) => {
    const eventName = row.eventName?.trim();
    const eventId = eventName ? existing.eventIds.get(eventName) : null;
    const old = row.shooterId && eventId !== undefined
      ? existing.results.get(resultKey(row.shooterId, eventId, disciplineMap[row.disciplineCode], row.category ?? "senior"))
      : undefined;
    if (!old) return { status: "new", changes: [] };
    const columns = resultColumns(row);
    const changes = changedParts(changedColumns(old, upsertedResult(old, { ...columns, clubId: row.clubId }, row.elimRound != null && row.qualTotal == null)));
    return { status: changes.length ? "changed" : "same", changes };
  });
}

/** Commits reviewed individual result rows and refreshes their forma cache. */
export async function commitImportReview(payload: CommitPayload): Promise<CommitResult> {
  const { competition: comp, rows } = payload;
  const competitionTags = payload.tags ?? comp?.tags ?? [];
  let competitionId: number;

  if (payload.competitionId) {
    competitionId = payload.competitionId;
    await addCompetitionTags(competitionId, competitionTags);
  } else {
    if (!comp?.name || !comp.date || !comp.level) {
      throw new CommitValidationError("Izaberi takmičenje ili popuni podatke");
    }
    const existing = await db.query.competitions.findFirst({
      where: and(eq(competitions.name, comp.name), eq(competitions.date, comp.date)),
    });
    if (existing) {
      competitionId = existing.id;
      await addCompetitionTags(competitionId, competitionTags);
    } else {
      const [created] = await db.insert(competitions).values({
        name: comp.name, date: comp.date, dateEnd: comp.dateEnd ?? null,
        location: comp.location, level: comp.level, eventType: comp.eventType && comp.eventType !== "other" ? comp.eventType : eventTypeFromName(comp.name),
        organizer: comp.organizer ?? null, tags: competitionTags,
        disciplineGroups: groupsFromName(comp.name),
      }).returning({ id: competitions.id });
      competitionId = created.id;
    }
  }

  const disciplineMap = Object.fromEntries((await db.select().from(disciplines)).map((d) => [d.code, d.id]));
  const known = await loadKnownShooters();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  const errors: string[] = [];
  const affectedShooterIds = new Set<number>();
  const existingResults = await loadExisting(competitionId);
  const eventIds = existingResults.eventIds;
  const competitionDate = comp?.date
    ?? (await db.query.competitions.findFirst({ where: eq(competitions.id, competitionId), columns: { date: true } }))?.date;
  async function eventIdFor(name: string, date: string | null | undefined) {
    if (!eventIds.has(name)) eventIds.set(name, await ensureCompetitionEvent(competitionId, name, date ?? competitionDate!));
    return eventIds.get(name)!;
  }

  for (const row of rows) {
    if (row.skip) { skipped++; continue; }
    // SIUS redovi u issfId nose lokalni SIUS ID (npr. "S35/21945") — u shooters.issf_id sme samo pravi ISSF ID
    const rowIssfId = asIssfId(row.issfId);
    try {
      let clubId = row.clubId;
      if (!clubId && row.clubAbbr) {
        const existing = await db.query.clubs.findFirst({ where: eq(clubs.nocCode, row.clubAbbr) });
        if (existing) clubId = existing.id;
        else {
          const [created] = await db.insert(clubs).values({
            name: row.clubAbbr, nocCode: row.clubAbbr, countryCode: row.teamNoc,
          }).returning({ id: clubs.id });
          clubId = created.id;
        }
      }

      let shooterId = row.shooterId;
      if (!shooterId) {
        const meta = DISCIPLINE_META[row.disciplineCode];
        shooterId = await ensureShooter({
          firstName: row.firstName, lastName: row.lastName, teamNoc: row.teamNoc, birthYear: row.birthYear,
          gender: row.gender ?? meta?.gender, apparatus: row.apparatus ?? meta?.apparatus, clubId, issfId: rowIssfId,
        }, known, { category: row.category, date: row.eventDate ?? competitionDate });
      } else if (rowIssfId && !known.byIssfId.has(rowIssfId)) {
        // Strelac izabran u review-u (ili po imenu u ingest-u) — poveži ga sa ISSF ID-jem iz reda
        const chosen = known.all.find((shooter) => shooter.id === shooterId);
        if (chosen && !chosen.issfId) {
          await db.update(shooters).set({ issfId: rowIssfId }).where(eq(shooters.id, chosen.id));
          chosen.issfId = rowIssfId;
          known.byIssfId.set(rowIssfId, chosen);
        }
      }

      const disciplineId = disciplineMap[row.disciplineCode];
      if (!disciplineId) { errors.push(`Unknown discipline: ${row.disciplineCode}`); continue; }
      const isElimOnly = row.elimRound != null && row.qualTotal == null;
      const columns = resultColumns(row);
      const category = (row.category ?? "senior") as typeof results.$inferInsert.category & string;
      const eventName = row.eventName?.trim();
      const knownEventId = eventName ? eventIds.get(eventName) : null;
      const key = knownEventId !== undefined ? resultKey(shooterId, knownEventId, disciplineId, category) : null;
      const old = key ? existingResults.results.get(key) : undefined;
      const next = old ? upsertedResult(old, { ...columns, clubId }, isElimOnly) : null;
      if (old && next && changedColumns(old, next).length === 0) { unchanged++; continue; }

      const competitionEventId = eventName ? await eventIdFor(eventName, row.eventDate) : null;
      const values = {
        shooterId, competitionId, competitionEventId, disciplineId, category,
        clubId: clubId ?? null,
        ...columns,
        source: payload.source ?? "pdf_import",
      };
      if (isElimOnly) {
        await db.insert(results).values(values).onConflictDoUpdate({
          target: [results.shooterId, results.competitionId, results.competitionEventId, results.disciplineId, results.category],
          set: { elimRound: sql`excluded.elim_round`, elimTotal: sql`excluded.elim_total`, elimRank: sql`excluded.elim_rank`, elimDetail: sql`excluded.elim_detail`, elimRemark: sql`excluded.elim_remark`, remarkDetails: mergeRemarkDetails },
        });
      } else await db.insert(results).values(values).onConflictDoUpdate({
        target: [results.shooterId, results.competitionId, results.competitionEventId, results.disciplineId, results.category],
        set: {
          clubId: sql`coalesce(excluded.club_id, ${results.clubId})`,
          qualTotal: sql`excluded.qual_total`, qualInners: sql`excluded.qual_inners`, qualRank: sql`excluded.qual_rank`, qualDetail: sql`excluded.qual_detail`,
          qualified: sql`coalesce(excluded.qualified, ${results.qualified})`,
          finalTotal: sql`excluded.final_total`, finalRank: sql`excluded.final_rank`, finalDetail: sql`excluded.final_detail`,
          qualRemark: sql`excluded.qual_remark`, finalRemark: sql`excluded.final_remark`,
          // Eliminacije se dopisuju i na postojeći red; uvoz bez njih ih ne briše
          elimRound: sql`coalesce(excluded.elim_round, ${results.elimRound})`, elimTotal: sql`coalesce(excluded.elim_total, ${results.elimTotal})`,
          elimRank: sql`coalesce(excluded.elim_rank, ${results.elimRank})`, elimDetail: sql`coalesce(excluded.elim_detail, ${results.elimDetail})`,
          elimRemark: sql`coalesce(excluded.elim_remark, ${results.elimRemark})`,
          remarkDetails: mergeRemarkDetails,
          source: sql`excluded.source`,
        },
      });
      inserted++;
      if (old) updated++;
      affectedShooterIds.add(shooterId);
      existingResults.results.set(resultKey(shooterId, competitionEventId, disciplineId, category), { ...old, ...(next ?? values) });
    } catch (error) {
      errors.push(`${row.lastName} ${row.firstName} (${row.teamNoc}): ${String(error)}`);
    }
  }

  if (inserted) await refreshDisciplineGroups(competitionId);
  const affectedIds = [...affectedShooterIds];
  if (affectedIds.length) {
    try {
      await recomputeFormaCache(affectedIds);
    } catch (error) {
      // Result import succeeded, but public rankings can remain stale until the next recompute.
      errors.push(`[forma-cache] ${String(error)}`);
    }
  }
  return { inserted, updated, unchanged, skipped, errors, competitionId };
}
