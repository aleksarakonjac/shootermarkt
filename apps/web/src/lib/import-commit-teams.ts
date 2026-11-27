import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { clubs, competitionEvents, competitions, disciplines, results, shooters, teamResultMembers, teamResults } from "@shootermarkt/db/schema";
import { foldName } from "@shootermarkt/db/name-match";
import { DISCIPLINE_META, type TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import { ensureCompetitionEvent } from "@/lib/competition-events";
import { formatDateSr } from "@/lib/date-utils";
import { ensureShooter, loadKnownShooters } from "@/lib/ensure-shooter";
import type { ImportStatus } from "@/lib/import-diff";
import { pickMemberShooter, teamDiff, type TeamSnapshot } from "@/lib/team-member-link";
import { revalidateShooterPages } from "@/lib/revalidate-public";

type StoredTeam = TeamSnapshot & { id: number };

const teamKey = (eventId: number | null, disciplineId: number, category: string, teamName: string) =>
  `${eventId ?? ""}|${disciplineId}|${category}|${teamName}`;

/** Postojeće ekipe i mečevi takmičenja, za poređenje pre upisa. */
async function loadExisting(competitionId: number) {
  const [teams, events, disciplineRows] = await Promise.all([
    db.select().from(teamResults).where(eq(teamResults.competitionId, competitionId)),
    db.select({ id: competitionEvents.id, name: competitionEvents.name, date: competitionEvents.date }).from(competitionEvents).where(eq(competitionEvents.competitionId, competitionId)),
    db.select({ id: disciplines.id, code: disciplines.code }).from(disciplines),
  ]);
  const members = teams.length
    ? await db.select().from(teamResultMembers).where(inArray(teamResultMembers.teamResultId, teams.map((t) => t.id))).orderBy(teamResultMembers.position)
    : [];
  return {
    teams: new Map<string, StoredTeam>(teams.map((t) => [
      teamKey(t.competitionEventId, t.disciplineId, t.category, t.teamName),
      { ...t, members: members.filter((m) => m.teamResultId === t.id) },
    ])),
    events: new Map(events.map((e) => [e.name, e])),
    disciplineIds: new Map<string, number>(disciplineRows.map((d) => [d.code, d.id])),
  };
}

const snapshot = (e: TeamResultEntry, links: (number | null)[]): TeamSnapshot => ({
  rank: e.rank, total: e.total, inners: e.inners, remark: e.remark ?? null,
  members: e.members.map((m, i) => ({ name: `${m.lastName} ${m.firstName}`.trim(), series: m.series, total: m.total, inners: m.inners, shooterId: links[i] ?? null })),
});

/** Šta bi uvoz uradio sa svakom ekipom, bez ijednog upisa. */
export async function previewTeamResults(competitionId: number, entries: TeamResultEntry[]): Promise<{ status: ImportStatus; changes: string[] }[]> {
  const existing = await loadExisting(competitionId);
  return entries.map((e) => {
    const name = e.eventName?.trim();
    const eventId = name ? existing.events.get(name)?.id : null;
    const old = eventId === undefined ? undefined
      : existing.teams.get(teamKey(eventId, existing.disciplineIds.get(e.disciplineCode)!, e.category, e.teamName));
    if (!old) return { status: "new", changes: [] };
    const changes = teamDiff(old, snapshot(e, []));
    return { status: changes.length ? "changed" : "same", changes };
  });
}

/** Upisuje ekipe iz pregleda; članove vezuje za strelce, a nepostojeće pravi kao pojedinačni uvoz. */
export async function commitTeamResults(competitionId: number, entries: TeamResultEntry[]) {
  const existing = await loadExisting(competitionId);
  const [individuals, allClubs, known, competition] = await Promise.all([
    db.select({ shooterId: results.shooterId, firstName: shooters.firstName, lastName: shooters.lastName, disciplineId: results.disciplineId })
      .from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).where(eq(results.competitionId, competitionId)),
    db.select({ id: clubs.id, name: clubs.name, nocCode: clubs.nocCode }).from(clubs),
    loadKnownShooters(),
    db.query.competitions.findFirst({ where: eq(competitions.id, competitionId), columns: { date: true } }),
  ]);
  let inserted = 0, updated = 0, unchanged = 0, skipped = 0;
  const errors: string[] = [];
  const touched = new Set<number>();

  for (const e of entries) {
    if (e.skip) { skipped++; continue; }
    try {
      const disciplineId = existing.disciplineIds.get(e.disciplineCode);
      const meta = DISCIPLINE_META[e.disciplineCode];
      if (!disciplineId || !meta || !e.teamName?.trim()) throw new Error("nepoznata disciplina ili naziv ekipe");

      const name = e.eventName?.trim();
      let eventId: number | null = null;
      if (name) {
        const event = existing.events.get(name);
        // meč ima jedan datum: isti naziv sa drugim datumom bi tiho progutao datum ekipe
        if (event && e.eventDate && event.date !== e.eventDate) throw new Error(`meč „${name}“ već ima datum ${formatDateSr(event.date)} — upiši drugi naziv`);
        const date = e.eventDate ?? competition!.date;
        eventId = event?.id ?? await ensureCompetitionEvent(competitionId, name, date);
        if (!event) existing.events.set(name, { id: eventId, name, date });
      }

      const old = existing.teams.get(teamKey(eventId, disciplineId, e.category, e.teamName));
      const own = individuals.filter((r) => r.disciplineId === disciplineId);
      const club = allClubs.find((c) => [c.name, c.nocCode].some((v) => v && foldName(v) === foldName(e.teamName)));
      const links: number[] = [];
      for (const m of e.members) {
        const before = old?.members.find((x) => foldName(x.name) === foldName(`${m.lastName} ${m.firstName}`))?.shooterId ?? null;
        links.push(pickMemberShooter(m, before, own) ?? await ensureShooter({
          firstName: m.firstName, lastName: m.lastName, teamNoc: m.teamNoc,
          gender: meta.gender ?? undefined, apparatus: meta.apparatus, clubId: club?.id,
        }, known));
      }

      const next = snapshot(e, links);
      if (old && teamDiff(old, next).length === 0) { unchanged++; continue; }
      const columns = { rank: next.rank, total: next.total == null ? null : String(next.total), inners: next.inners, remark: next.remark };
      await db.transaction(async (tx) => {
        const [team] = await tx.insert(teamResults)
          .values({ competitionId, competitionEventId: eventId, disciplineId, category: e.category, teamName: e.teamName, ...columns, source: "pdf_import" })
          .onConflictDoUpdate({
            target: [teamResults.competitionId, teamResults.competitionEventId, teamResults.disciplineId, teamResults.category, teamResults.teamName],
            set: { ...columns, source: sql`excluded.source` },
          })
          .returning({ id: teamResults.id });
        await tx.delete(teamResultMembers).where(eq(teamResultMembers.teamResultId, team.id));
        if (next.members.length) {
          await tx.insert(teamResultMembers).values(next.members.map((m, i) => ({
            teamResultId: team.id, position: i + 1, shooterId: m.shooterId, name: m.name, series: m.series, total: String(m.total), inners: m.inners,
          })));
        }
      });
      if (old) updated++;
      inserted++;
      links.forEach((id) => touched.add(id));
    } catch (error) {
      errors.push(`${e.teamName} (${e.disciplineCode}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  revalidateShooterPages(touched);
  return { inserted, updated, unchanged, skipped, errors };
}
