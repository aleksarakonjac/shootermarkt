import { db } from "@/lib/db";
import { clubs, shooters } from "@/lib/db/schema";
import { matchShooter, foldName } from "@/lib/name-match";
import { parsePdfWithGemini } from "./gemini-adapter";
import { DISCIPLINE_META, IMPORTED_DISCIPLINE_CODES, dedupeRowsByCategory, mergeFinalsIntoRows, type ParsedShooterResult, type ReviewRow } from "./types";

export async function parsePdfImport(pdfBuffer: Buffer) {
  const [bilten, allClubs, allShooters] = await Promise.all([
    parsePdfWithGemini(pdfBuffer),
    db.select().from(clubs),
    db.select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality, clubId: shooters.clubId }).from(shooters),
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
        category: event.category,
        qualTotal: result.total,
        qualInners: result.inners ?? null,
        qualRank: result.rank,
        qualSeries: result.series,
        qualified: result.qualified ?? null,
        remark: result.remark ?? null,
      };
      if (!shooterId) row.warning = match.kind === "suggestion" ? `Možda: ${match.name}` : event.isInternational ? `Novi strelac (${nationality}) — biće kreiran` : "Novi strelac — biće kreiran";
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
  };
}
