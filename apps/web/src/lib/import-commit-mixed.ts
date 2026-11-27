import { db } from "@shootermarkt/db";
import { competitionEvents, competitions, disciplines, mixedTeamResults, results, shooters } from "@shootermarkt/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { MixedTeamEntry } from "@/app/(site)/(admin)/admin/rezultati/_shared/MixedTeamReviewTable";
import { eventTypeFromName } from "@/lib/competition-filters";
import { ensureCompetitionEvent } from "@/lib/competition-events";
import { formatDateSr } from "@/lib/date-utils";
import { ensureShooter, loadKnownShooters, shooterResultCount } from "@/lib/ensure-shooter";
import { pickMemberShooter } from "@/lib/team-member-link";
import { linkTeamMembers } from "@/lib/mixed-team-link";
import { changedColumns, changedParts, type ImportStatus } from "@/lib/import-diff";
import { commitMixedStages, toFinalCommit, toQualCommit } from "@/app/(site)/(admin)/admin/rezultati/_shared/commitMixedTeams";
import { isUnrankedRemark, type CompetitionLevel, type EventType, type StageRemarks } from "@shootermarkt/db/pdf-import-types";

export class MixedCommitError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export interface MixedCommitEntry {
  skip?: boolean;
  nocCode: string;
  teamNumber?: number;
  qualRank?: number | null;
  qualTotal?: number | null;
  qualInners?: number | null;
  qualRemark?: string | null;
  qualified?: boolean | null;
  m_lastName?: string;
  m_firstName?: string;
  m_series?: number[];
  mInners?: number | null;
  mTotal?: number;
  f_lastName?: string;
  f_firstName?: string;
  f_series?: number[];
  fInners?: number | null;
  fTotal?: number;
  finalRank?: number | null;
  finalTotal?: number | null;
  finalRemark?: string | null;
  mFinalSeries?: number[];
  fFinalSeries?: number[];
  clubName?: string;
  /** PDF uvoz: član bez veze se pravi kao nov strelac (ostali izvori ne prave strelce). */
  createMissing?: boolean;
  mShooterId?: number;
  fShooterId?: number;
  mGender?: "M" | "F";
  fGender?: "M" | "F";
  /** Penalty / shoot-off / record marks of the stage being committed. */
  extras?: StageRemarks;
}

/** Shallow per-stage merge: qualification and finals are committed in separate calls. */
const mergeRemarkDetails = sql`coalesce(${mixedTeamResults.remarkDetails} || excluded.remark_details, excluded.remark_details, ${mixedTeamResults.remarkDetails})`;

/** Kolone koje upisuje jedna faza (bez ključa, `remarkDetails` i `source`). */
function stageColumns(e: MixedCommitEntry, isFinals: boolean) {
  if (isFinals) {
    return {
      finalRank: e.finalRank ?? null,
      finalTotal: e.finalTotal != null ? String(e.finalTotal) : null,
      finalRemark: e.finalRemark ?? null,
      shooter1FinalDetail: e.mFinalSeries?.length ? { series: e.mFinalSeries } : null,
      shooter2FinalDetail: e.fFinalSeries?.length ? { series: e.fFinalSeries } : null,
    };
  }
  return {
    // izvor bez kluba ne briše već upisan
    ...(e.clubName ? { clubName: e.clubName } : {}),
    shooter1Name: `${e.m_lastName} ${e.m_firstName}`.trim() || null,
    shooter2Name: `${e.f_lastName} ${e.f_firstName}`.trim() || null,
    // strelac tima bez plasmana koji nije pucao nema rezultat (umesto lažne nule)
    shooter1Detail: isUnrankedRemark(e.qualRemark) && !e.m_series?.length && !e.mTotal ? null : { series: e.m_series ?? [], inners: e.mInners ?? null, total: e.mTotal ?? 0 },
    shooter2Detail: isUnrankedRemark(e.qualRemark) && !e.f_series?.length && !e.fTotal ? null : { series: e.f_series ?? [], inners: e.fInners ?? null, total: e.fTotal ?? 0 },
    qualRank: isUnrankedRemark(e.qualRemark) ? null : e.qualRank ?? null,
    qualTotal: e.qualTotal != null ? String(e.qualTotal) : null,
    qualInners: e.qualInners ?? null,
    qualRemark: e.qualRemark ?? null,
    qualified: e.qualified ?? null,
  };
}

const teamKey = (nocCode: string, teamNumber: number | undefined) => `${nocCode}#${teamNumber ?? 1}`;

async function loadTeams(competitionId: number, eventId: number | null, disciplineId: number, category: NonNullable<MixedCommitInput["category"]>) {
  const rows = await db.select().from(mixedTeamResults).where(and(
    eq(mixedTeamResults.competitionId, competitionId), eq(mixedTeamResults.disciplineId, disciplineId), eq(mixedTeamResults.category, category),
    eventId === null ? isNull(mixedTeamResults.competitionEventId) : eq(mixedTeamResults.competitionEventId, eventId),
  ));
  return new Map<string, Record<string, unknown>>(rows.map((r) => [teamKey(r.nocCode, r.teamNumber), r]));
}

/** Kolone koje bi se promenile upisom faze u postojeći red tima. */
function teamChanges(old: Record<string, unknown>, e: MixedCommitEntry, isFinals: boolean) {
  const remarkDetails = e.extras
    ? { ...(old.remarkDetails as object | null), [isFinals ? "final" : "qual"]: e.extras }
    : old.remarkDetails;
  return changedColumns(old, { ...stageColumns(e, isFinals), remarkDetails });
}

/** Šta bi uvoz uradio sa svakim mešovitim timom, bez ijednog upisa. */
export async function previewMixedTeams(competitionId: number, entries: MixedTeamEntry[]): Promise<{ status: ImportStatus; changes: string[] }[]> {
  const disciplineIds = new Map<string, number>((await db.select().from(disciplines)).map((d) => [d.code, d.id]));
  const [rows, events] = await Promise.all([
    db.select().from(mixedTeamResults).where(eq(mixedTeamResults.competitionId, competitionId)),
    db.select({ id: competitionEvents.id, name: competitionEvents.name }).from(competitionEvents).where(eq(competitionEvents.competitionId, competitionId)),
  ]);
  const eventIds = new Map(events.map((ev) => [ev.name, ev.id]));
  return entries.map((e) => {
    const name = e.eventName?.trim();
    // meč koji još ne postoji → svi njegovi timovi su novi
    const eventId = name ? eventIds.get(name) : null;
    const old = eventId === undefined ? undefined : rows.find((r) => r.disciplineId === disciplineIds.get(e.disciplineCode) && r.category === (e.category ?? "senior")
      && r.competitionEventId === eventId && r.nocCode === e.nocCode && r.teamNumber === e.teamNumber);
    if (!old) return { status: "new", changes: [] };
    const columns = teamChanges(old, toQualCommit(e), false);
    if (e.finalRank != null) columns.push(...teamChanges(old, toFinalCommit(e), true));
    const changes = changedParts(columns);
    return { status: changes.length ? "changed" : "same", changes };
  });
}

export interface MixedCommitInput {
  discipline: string;
  /** Senior i junior mixed team su odvojeni događaji iste discipline. */
  category?: typeof mixedTeamResults.$inferInsert["category"];
  isFinals: boolean;
  entries: MixedCommitEntry[];
  /** Zaseban meč (competition_events); null/izostavljeno = glavni meč. */
  eventName?: string | null;
  eventDate?: string | null;
  competitionId?: number;
  competition?: { name: string; date: string; location?: string; level: CompetitionLevel; eventType?: EventType };
}

/** Upserts mixed-team qualification or finals rows for one discipline. */
export async function commitMixedTeamEntries(input: MixedCommitInput) {
  const { discipline: code, isFinals, entries } = input;
  const category = input.category ?? "senior";
  if (!code || !Array.isArray(entries)) throw new MixedCommitError("Invalid payload", 400);

  // Resolve or create competition
  let competitionId: number | undefined = input.competitionId;
  if (!competitionId && input.competition) {
    const comp = input.competition;
    const existing = await db.query.competitions.findFirst({
      where: and(eq(competitions.name, comp.name), eq(competitions.date, comp.date)),
    });
    if (existing) {
      competitionId = existing.id;
    } else {
      const [ins] = await db
        .insert(competitions)
        .values({
          name: comp.name,
          date: comp.date,
          location: comp.location,
          level: comp.level,
          eventType: comp.eventType && comp.eventType !== "other" ? comp.eventType : eventTypeFromName(comp.name),
        })
        .returning({ id: competitions.id });
      competitionId = ins.id;
    }
  }

  if (!competitionId) {
    throw new MixedCommitError("competitionId or competition required", 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disc = await db.query.disciplines.findFirst({ where: eq(disciplines.code, code as any) });
  if (!disc) throw new MixedCommitError("Discipline not found", 404);

  let inserted = 0, skipped = 0, unchanged = 0;
  /** Timovi upisani u ovoj fazi (novi ili izmenjeni) — pozivalac spaja kvalifikacije i finale. */
  const written: string[] = [], updated: string[] = [];
  const errors: string[] = [];
  const eventName = input.eventName?.trim();
  let eventDate = input.eventDate;
  if (eventName && !eventDate) {
    eventDate = (await db.query.competitions.findFirst({ where: eq(competitions.id, competitionId), columns: { date: true } }))?.date;
  }
  if (eventName && input.eventDate) {
    // meč ima jedan datum: postojeći meč istog naziva sa drugim datumom bi tiho progutao datum timova
    const existingEvent = await db.query.competitionEvents.findFirst({
      where: and(eq(competitionEvents.competitionId, competitionId), eq(competitionEvents.name, eventName)),
      columns: { date: true },
    });
    if (existingEvent && existingEvent.date !== input.eventDate) {
      throw new MixedCommitError(`Meč „${eventName}“ već ima datum ${formatDateSr(existingEvent.date)} — za timove upiši drugi naziv.`, 409);
    }
  }
  const competitionEventId = eventName ? await ensureCompetitionEvent(competitionId, eventName, eventDate!) : null;
  const existing = await loadTeams(competitionId, competitionEventId, disc.id, category);
  // Članovi se povezuju pri upisu kvalifikacija (finale nosi iste ljude).
  const candidates = isFinals ? [] : await db.select({
    id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName,
    previousLastNames: shooters.previousLastNames, previousFirstNames: shooters.previousFirstNames,
    nationality: shooters.nationality, resultCount: shooterResultCount,
  }).from(shooters);
  const creating = !isFinals && entries.some((e) => e.createMissing && !e.skip);
  const known = creating ? await loadKnownShooters() : null;
  // pojedinačni nastupi istim oružjem na ovom takmičenju (ARMT → ARM/ARW)
  const individuals = creating ? await db.select({ shooterId: results.shooterId, firstName: shooters.firstName, lastName: shooters.lastName })
    .from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(and(eq(results.competitionId, competitionId), eq(disciplines.apparatus, disc.apparatus!))) : [];

  for (const e of entries) {
    if (e.skip) { skipped++; continue; }
    try {
      const key = teamKey(e.nocCode, e.teamNumber);
      const old = existing.get(key);
      const links: { shooter1Id?: number | null; shooter2Id?: number | null } = isFinals ? {} : linkTeamMembers(e, e.nocCode, candidates);
      if (known && e.createMissing) {
        const [mNoc, fNoc = mNoc] = e.nocCode.split("/");
        const member = async (firstName: string, lastName: string, shooterId: number | undefined, before: unknown, linked: number | null | undefined, teamNoc: string, gender: "M" | "F") =>
          pickMemberShooter({ firstName, lastName, shooterId }, (before as number | null) ?? null, individuals)
          ?? linked
          ?? (firstName.trim() && lastName.trim() ? await ensureShooter({ firstName, lastName, teamNoc, gender, apparatus: disc.apparatus }, known) : null);
        links.shooter1Id = await member(e.m_firstName ?? "", e.m_lastName ?? "", e.mShooterId, old?.shooter1Id, links.shooter1Id, mNoc, e.mGender ?? "M");
        links.shooter2Id = await member(e.f_firstName ?? "", e.f_lastName ?? "", e.fShooterId, old?.shooter2Id, links.shooter2Id, fNoc, e.fGender ?? "F");
      }
      // nova veza sa profilom je izmena i kad su rezultati isti (timovi uvezeni pre povezivanja)
      const newLink = old && !isFinals && ((!old.shooter1Id && links.shooter1Id) || (!old.shooter2Id && links.shooter2Id));
      if (old && !newLink && teamChanges(old, e, isFinals).length === 0) { unchanged++; continue; }
      const columns = stageColumns(e, isFinals);
      await db
        .insert(mixedTeamResults)
        .values({
          competitionId,
          disciplineId: disc.id,
          category,
          nocCode: e.nocCode,
          teamNumber: e.teamNumber ?? 1,
          competitionEventId,
          ...columns,
          ...links,
          remarkDetails: e.extras ? { [isFinals ? "final" : "qual"]: e.extras } : null,
          source: "manual",
        })
        .onConflictDoUpdate({
          target: [mixedTeamResults.competitionId, mixedTeamResults.competitionEventId, mixedTeamResults.disciplineId, mixedTeamResults.category, mixedTeamResults.nocCode, mixedTeamResults.teamNumber],
          set: {
            ...columns,
            // postojeća veza (live cron, ručno povezivanje) se ne gazi
            ...(isFinals ? {} : {
              shooter1Id: sql`coalesce(${mixedTeamResults.shooter1Id}, excluded.shooter1_id)`,
              shooter2Id: sql`coalesce(${mixedTeamResults.shooter2Id}, excluded.shooter2_id)`,
            }),
            remarkDetails: mergeRemarkDetails,
          },
        });
      inserted++;
      written.push(key);
      if (old) updated.push(key);
    } catch (err) {
      errors.push(`${e.nocCode}: ${String(err)}`);
    }
  }

  return { inserted, skipped, unchanged, written, updated, errors, competitionId };
}


/** Commits reviewed mixed-team entries (qualification, then finals) per discipline; same payloads as the admin UI. */
export async function commitMixedTeamsDirect(competitionId: number, entries: MixedTeamEntry[]) {
  return commitMixedStages(entries, (input) => commitMixedTeamEntries({ competitionId, ...input }));
}
