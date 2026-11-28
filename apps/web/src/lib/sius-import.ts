// Čiste funkcije žive u sius-merge.ts (client-safe, bez DB-a) — ovde re-export za postojeće pozivaoce
export { mergeSiusFinals, type SiusFinalEntry } from "@/lib/sius-merge";
import { fetchSiusEvents, fetchLiveSiusResults, fetchLiveSiusMixedTeamResults, fetchSiusEscSoloResults, escSoloCodeFromEvent, mixedTeamIdentity, isJuniorEventCode, parseSiusMatchKey, MIXED_TEAM_CODES } from "@shootermarkt/adapters/sius/public-adapter";
import { matchEventName } from "@/lib/competition-events";
import { shooterResultCount } from "@/lib/ensure-shooter";
import { db } from "@shootermarkt/db";
import { competitions, shooters } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { isUnrankedRemark, type ReviewRow } from "@shootermarkt/db/pdf-import-types";
import type { MixedTeamEntry } from "@/app/(site)/(admin)/admin/rezultati/_shared/MixedTeamReviewTable";
import { escSoloReviewRows, mixedTeamMatch, stageRemarks, type SiusFinalEntry } from "@/lib/sius-merge";
import { matchAthlete, type AgeContext } from "@shootermarkt/db/name-match";

/** ESC Solo SIUS eventi (juniorske varijante se ne nagađaju dok se ne pojave u podacima). */
export const ESC_SOLO_EVENT_CODES = ["ARM-ECH-SOLO", "ARW-ECH-SOLO", "APM-ECH-SOLO", "APW-ECH-SOLO", "ARMJ-ECH-SOLO", "ARWJ-ECH-SOLO", "APMJ-ECH-SOLO", "APWJ-ECH-SOLO"];

const SUPPORTED_CODES = ["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "RPRM", "RPRW", "SPW", "SPM", "FPM", "FPW", "RFPM", "STPM", "STPW", "R3P300M", "R3P300W", "RPR300M", "RPR300W", "STR300"] as const;

/** SIUS juniorski događaji imaju sufiks J (ARMJ, APMTJ…): osnovna disciplina + kategorija junior (U21). */
function splitEventCode(eventCode: string): { code: string; category: ReviewRow["category"] } {
  // Evropska U16/U18 prvenstva: 10ARU18W → ARW, mlađi junior (U18) / kadet (U16).
  const youth = eventCode.match(/^10(AR|AP)(U16|U18)([MW])$/);
  if (youth) return { code: `${youth[1]}${youth[3]}`, category: youth[2] === "U18" ? "mladji_junior" : "kadet" };
  return isJuniorEventCode(eventCode) ? { code: eventCode.slice(0, -1), category: "junior" } : { code: eventCode, category: "senior" };
}
const YOUTH_CODES = ["AR", "AP"].flatMap((d) => ["U16", "U18"].flatMap((u) => ["M", "W"].map((g) => `10${d}${u}${g}`)));
const withJunior = (codes: readonly string[]) => [...codes, ...codes.map((c) => `${c}J`), ...YOUTH_CODES];

export class SiusImportError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Fetches SIUS public results for a competition UUID and shapes them as review rows (no DB writes). */
export async function buildSiusImport(siusId: string, disciplineCodes?: string[], competitionId?: number) {
  const requested = [
    ...withJunior((disciplineCodes ?? [...SUPPORTED_CODES, ...MIXED_TEAM_CODES]).filter((c) => !escSoloCodeFromEvent(c))),
    ...(disciplineCodes ?? ESC_SOLO_EVENT_CODES).filter((c) => escSoloCodeFromEvent(c)),
  ];
  const soloCodes = requested.filter((c) => escSoloCodeFromEvent(c));
  const codes = requested.filter((c) => (SUPPORTED_CODES as readonly string[]).includes(splitEventCode(c).code));
  const mixedCodes = requested.filter((c) => MIXED_TEAM_CODES.has(splitEventCode(c).code));

  const allShooters = await db
    .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, previousLastNames: shooters.previousLastNames, previousFirstNames: shooters.previousFirstNames, nationality: shooters.nationality, resultCount: shooterResultCount, issfId: shooters.issfId, birthYear: shooters.birthYear })
    .from(shooters);
  const matchId = (athleteId: string | null, firstName: string, lastName: string, noc: string, age: AgeContext) => {
    const match = matchAthlete(athleteId, firstName, lastName, noc, allShooters, { age });
    return match.kind === "exact" ? match.id : undefined;
  };

  let siusData: Awaited<ReturnType<typeof fetchLiveSiusResults>> = new Map();
  if (codes.length > 0) {
    try {
      siusData = await fetchLiveSiusResults(siusId, codes, { includeUnranked: true });
    } catch (e) {
      throw new SiusImportError(`SIUS fetch failed: ${e}`, 502);
    }
  }

  let mixedData: Awaited<ReturnType<typeof fetchLiveSiusMixedTeamResults>> = new Map();
  if (mixedCodes.length > 0) {
    try {
      mixedData = await fetchLiveSiusMixedTeamResults(siusId, mixedCodes, { includeUnranked: true });
    } catch (e) {
      throw new SiusImportError(`SIUS mixed-team fetch failed: ${e}`, 502);
    }
  }

  const soloRows: ReviewRow[] = [];
  let soloEventCount = 0;
  if (soloCodes.length > 0) {
    try {
      const soloEvents = (await fetchSiusEvents(siusId)).filter((e) => soloCodes.includes(e.eventCode));
      soloEventCount = soloEvents.length;
      for (const event of soloEvents) {
        const athletes = await fetchSiusEscSoloResults(siusId, event.runningId);
        const category = /J-ECH-SOLO$/.test(event.eventCode) ? "junior" : "senior";
        soloRows.push(...escSoloReviewRows(athletes, escSoloCodeFromEvent(event.eventCode)!, category,
          (id, first, last, noc) => matchId(id, first, last, noc, { category, date: event.startDate })));
      }
    } catch (e) {
      throw new SiusImportError(`SIUS ESC Solo fetch failed: ${e}`, 502);
    }
  }

  if (siusData.size === 0 && mixedData.size === 0 && soloRows.length === 0) {
    throw new SiusImportError("No results found for this competition UUID", 404);
  }

  const rows: ReviewRow[] = [...soloRows];
  const finalEntries: SiusFinalEntry[] = [];
  const errors: string[] = [];

  for (const [key, data] of siusData) {
    const { eventCode, match } = parseSiusMatchKey(key);
    const { code: disciplineCode, category } = splitEventCode(eventCode);
    const code = disciplineCode as ReviewRow["disciplineCode"];
    // disciplina sa više mečeva (npr. dva dana pojedinačnog) → svaki meč, i prvi, je event sa svojim datumom
    const eventName = (data.matchCount ?? 1) > 1 && data.date ? matchEventName(match, data.date) : null;
    const eventDate = eventName ? data.date! : null;

    if (data.qual.length === 0 && data.elim.length === 0) {
      errors.push(`${disciplineCode}: no results`);
      continue;
    }

    // Qual rows
    const discRows: ReviewRow[] = [];
    for (const r of data.qual) {
      const shooterId = matchId(r.siusAthleteId, r.firstName, r.lastName, r.nation, { category, date: data.date });

      discRows.push({
        shooterId,
        issfId: r.siusAthleteId ?? undefined,
        firstName: r.firstName,
        lastName: r.lastName,
        teamNoc: r.nation,
        disciplineCode: code,
        category,
        eventName,
        eventDate,
        // Unranked (DSQ/DNS) rows have no real score — null, not 0, so they never count as a result.
        qualTotal: r.rank === null ? null : r.total,
        qualInners: r.rank === null ? null : r.inners,
        qualRank: r.rank ?? undefined,
        qualSeries: r.series.length > 0 ? r.series : undefined,
        // Q iz SIUS-a (QualificationRemark); kad SIUS još nije dodelio Q ostaje null pa import ne gazi postojeće.
        qualified: r.qualified || null,
        remark: r.remark,
        remarkDetails: stageRemarks(r) ? { qual: stageRemarks(r) } : undefined,
        finalTotal: null,
        finalRank: null,
        warning: shooterId ? undefined : "Novi strelac — biće kreiran",
      });
    }

    // Merge elimination rounds — track last (highest) round each athlete reached.
    // If no qual data yet, seed discRows from elim participants first.
    for (const { round, results: elimResults } of data.elim) {
      for (const e of elimResults) {
        let row = discRows.find(
          (r) =>
            (e.siusAthleteId && r.issfId === e.siusAthleteId) ||
            (r.lastName.toLowerCase() === e.lastName.toLowerCase() &&
              r.firstName.toLowerCase() === e.firstName.toLowerCase())
        );
        if (!row) {
          if (data.qual.length > 0 && e.rank !== null) continue; // qual exists but shooter not found — skip (DSQ/DNS stay visible)
          const shooterId = matchId(e.siusAthleteId, e.firstName, e.lastName, e.nation, { category, date: data.date });
          row = {
            shooterId,
            issfId: e.siusAthleteId ?? undefined,
            firstName: e.firstName,
            lastName: e.lastName,
            teamNoc: e.nation,
            disciplineCode: code,
            category,
            eventName,
            eventDate,
            qualTotal: null,
            qualInners: null,
            qualRank: undefined,
            qualified: null,
            finalTotal: null,
            finalRank: null,
            warning: shooterId ? undefined : "Novi strelac — biće kreiran",
          };
          discRows.push(row);
        }
        if (row.elimRound == null || round > row.elimRound) {
          row.elimRound = round;
          row.elimTotal = e.rank === null ? null : Math.round(e.total);
          row.elimInners = e.inners;
          row.elimRank = e.rank ?? undefined;
          row.elimSeries = e.series.length > 0 ? e.series.map(Math.round) : null;
          row.elimRemark = e.remark;
          const elimExtra = stageRemarks(e);
          if (elimExtra) row.remarkDetails = { ...row.remarkDetails, elim: elimExtra };
        }
      }
    }

    // Mark qualified from qual results
    for (const row of discRows) {
      if (row.qualified == null) {
        // will be set on commit when finalEntries are matched
      }
    }

    rows.push(...discRows);

    // Final entries — separate, not merged into qual
    for (const f of data.final) {
      finalEntries.push({
        disciplineCode,
        category,
        eventName,
        eventDate,
        rank: f.rank,
        remark: f.remark,
        penalty: f.penalty,
        shootOff: f.shootOff,
        record: f.record,
        firstName: f.firstName,
        lastName: f.lastName,
        nation: f.nation,
        total: f.total,
        inners: f.inners,
        series: f.series,
        siusAthleteId: f.siusAthleteId,
      });
    }
  }

  const teamEntries: MixedTeamEntry[] = [];
  for (const [key, data] of mixedData) {
    const { eventCode, match } = parseSiusMatchKey(key);
    const { code, category } = splitEventCode(eventCode);
    const teamMatch = mixedTeamMatch(match, data.matchCount, data.date);
    if (!teamMatch) {
      errors.push(`${code}: ${match}. meč istog dana nije uvezen — prepisao bi prvi meč`);
      continue;
    }
    const { eventName, eventDate } = teamMatch;
    const disciplineCode = code as MixedTeamEntry["disciplineCode"];
    if (data.qual.length === 0 && data.final.length === 0) {
      errors.push(`${disciplineCode}: no results`);
      continue;
    }

    const byKey = new Map<string, MixedTeamEntry>();
    const nocCounts = new Map<string, number>();
    const nextTeamNumber = (nocCode: string) => {
      const teamNumber = (nocCounts.get(nocCode) ?? 0) + 1;
      nocCounts.set(nocCode, teamNumber);
      return teamNumber;
    };

    for (const r of data.qual) {
      const [a1, a2] = r.athletes;
      byKey.set(mixedTeamIdentity(r.athletes), {
        skip: false,
        nocCode: r.nocCode,
        teamNumber: nextTeamNumber(r.nocCode),
        disciplineCode,
        category,
        eventName,
        eventDate,
        qualRank: isUnrankedRemark(r.statusRemark) ? null : r.rank,
        qualTotal: r.rank === null ? null : r.total,
        inners: r.inners,
        qualRemark: r.statusRemark, // short mark only (qual_remark is varchar(10)); the penalty text goes to remarkDetails
        qualExtras: stageRemarks(r),
        qualified: r.qualified,
        finalRank: null,
        finalTotal: null,
        mIssfId: a1?.siusAthleteId ?? null,
        mLastName: a1?.lastName ?? "",
        mFirstName: a1?.firstName ?? "",
        m_series: a1?.series ?? [],
        mInners: a1?.inners ?? null,
        mTotal: a1?.total ?? 0,
        fIssfId: a2?.siusAthleteId ?? null,
        fLastName: a2?.lastName ?? "",
        fFirstName: a2?.firstName ?? "",
        f_series: a2?.series ?? [],
        fInners: a2?.inners ?? null,
        fTotal: a2?.total ?? 0,
      });
    }

    for (const r of data.final) {
      const key = mixedTeamIdentity(r.athletes);
      const existing = byKey.get(key);
      if (existing) {
        existing.finalRank = r.rank;
        existing.finalTotal = r.rank === null ? null : r.total;
        existing.finalRemark = r.remark;
        existing.finalExtras = stageRemarks(r);
        existing.mFinalSeries = r.athletes[0]?.series ?? [];
        existing.fFinalSeries = r.athletes[1]?.series ?? [];
      } else {
        const [a1, a2] = r.athletes;
        byKey.set(key, {
          skip: false,
          nocCode: r.nocCode,
          teamNumber: nextTeamNumber(r.nocCode),
          disciplineCode,
          category,
          eventName,
          eventDate,
          qualRank: null,
          qualTotal: null,
          inners: null,
          qualRemark: null,
          qualified: true,
          finalRank: r.rank,
          finalTotal: r.rank === null ? null : r.total,
          finalRemark: r.remark,
          finalExtras: stageRemarks(r),
          mIssfId: a1?.siusAthleteId ?? null,
          mLastName: a1?.lastName ?? "",
          mFirstName: a1?.firstName ?? "",
          m_series: [],
          mInners: null,
          mTotal: 0,
          mFinalSeries: a1?.series ?? [],
          fIssfId: a2?.siusAthleteId ?? null,
          fLastName: a2?.lastName ?? "",
          fFirstName: a2?.firstName ?? "",
          f_series: [],
          fInners: null,
          fTotal: 0,
          fFinalSeries: a2?.series ?? [],
        });
      }
    }

    teamEntries.push(...byKey.values());
  }

  if (!disciplineCodes) {
    // pun uvoz: prijavi SIUS događaje van podržanih disciplina umesto da nestanu bez traga
    const unsupported = [...new Set((await fetchSiusEvents(siusId).catch(() => []))
      .map((e) => e.eventCode)
      .filter((c) => !requested.includes(c)))];
    if (unsupported.length) errors.push(`Nije uvezeno (disciplina nije podržana): ${unsupported.join(", ")}`);
  }

  // SIUS kod "…J" je junior; na prvenstvima označenim U18 u nazivu to je mlađi junior.
  if (competitionId) {
    const [comp] = await db.select({ name: competitions.name }).from(competitions).where(eq(competitions.id, competitionId));
    if (/\bU-?18\b/i.test(comp?.name ?? "")) {
      for (const x of [...rows, ...finalEntries]) if (x.category === "junior") x.category = "mladji_junior";
    }
  }

  return { rows, finalEntries, teamEntries, eventCount: siusData.size + mixedData.size + soloEventCount, errors };
}
