import { db } from "@shootermarkt/db";
import { clubs, shooters } from "@shootermarkt/db/schema";
import { matchShooter, foldName } from "@shootermarkt/db/name-match";
import { parsePdfWithGemini } from "./gemini-adapter";
import { parseSiusPdf } from "./sius-pdf";
import { DISCIPLINE_META, IMPORTED_DISCIPLINE_CODES, dedupeRowsByCategory, mergeFinalsIntoRows, type ParsedShooterResult, type ReviewRow } from "@shootermarkt/db/pdf-import-types";

export async function parsePdfImport(pdfBuffer: Buffer) {
  let finalsError: string | undefined;
  const [bilten, allClubs, allShooters] = await Promise.all([
    // SIUS bilten se čita deterministički; Gemini samo za ne-SIUS PDF i (best-effort) za finala.
    parseSiusPdf(pdfBuffer).catch(() => null).then(async (sius) => {
      if (!sius) return parsePdfWithGemini(pdfBuffer);
      if (!sius.hasFinals) return sius;
      try {
        const g = await parsePdfWithGemini(pdfBuffer);
        return { events: [...sius.events, ...g.events.filter((e) => e.stage === "final")] };
      } catch (e) {
        finalsError = e instanceof Error ? e.message : String(e);
        return sius;
      }
    }),
    db.select().from(clubs),
    db.select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, previousLastNames: shooters.previousLastNames, previousFirstNames: shooters.previousFirstNames, nationality: shooters.nationality, clubId: shooters.clubId }).from(shooters),
  ]);
  const rows: ReviewRow[] = [];
  const skippedDisciplines = new Set<string>();

  for (const event of bilten.events) {
    if (event.stage !== "qualification") continue;
    if (!IMPORTED_DISCIPLINE_CODES.includes(event.discipline)) { skippedDisciplines.add(event.discipline); continue; }
    for (const rawResult of event.results) {
      const result = rawResult as ParsedShooterResult;
      const nationality = result.teamNoc.toUpperCase();
      const match = matchShooter(result.firstName, result.lastName, nationality, allShooters);
      const shooterId = match.kind === "exact" ? match.id : undefined;
      const shooterClubId = shooterId ? allShooters.find((shooter) => shooter.id === shooterId)?.clubId : undefined;
      let club = shooterClubId ? allClubs.find((candidate) => candidate.id === shooterClubId) : undefined;
      if (!club && result.clubName) {
        club = allClubs.find((candidate) => candidate.name.toLowerCase() === result.clubName!.toLowerCase() || candidate.nocCode?.toLowerCase() === result.clubName!.toLowerCase());
      }
      const meta = DISCIPLINE_META[event.discipline];
      const row: ReviewRow = {
        shooterId,
        isNew: !shooterId,
        suggestedShooterId: match.kind === "suggestion" ? match.id : undefined,
        suggestedName: match.kind === "suggestion" ? match.name : undefined,
        firstName: result.firstName,
        lastName: result.lastName,
        teamNoc: nationality,
        birthYear: result.birthYear ?? null,
        gender: meta?.gender ?? undefined,
        apparatus: meta?.apparatus,
        clubAbbr: result.clubName,
        clubId: club?.id,
        disciplineCode: event.discipline,
        eventName: event.eventName ?? null,
        eventDate: event.eventDate ?? null,
        category: event.category,
        qualTotal: result.total,
        qualInners: result.inners ?? null,
        qualRank: result.rank ?? undefined,
        qualSeries: result.series,
        qualified: result.qualified ?? null,
        remark: result.remark ?? null,
      };
      if (event.guest) {
        // ponytail: gosti nemaju svoje polje u bazi — preskočeni po defaultu, admin može da ih uključi
        row.skip = true;
        row.warning = "Gost (van konkurencije) — preskočen";
      } else if (!shooterId) row.warning = match.kind === "suggestion" ? `Možda: ${match.name}` : event.isInternational ? `Novi strelac (${nationality}) — biće kreiran` : "Novi strelac — biće kreiran";
      rows.push(row);
    }
  }

  const dedupedRows = dedupeRowsByCategory(rows, foldName);
  const finals = mergeFinalsIntoRows(dedupedRows, bilten.events, foldName);
  return {
    rows: finals.rows,
    eventsCount: bilten.events.length,
    skippedDisciplines: Array.from(skippedDisciplines),
    matchedFinals: finals.matchedFinals,
    unmatchedFinals: finals.unmatchedFinals,
    finalsError,
  };
}
