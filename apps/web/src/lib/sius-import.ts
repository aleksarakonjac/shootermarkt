import { fetchLiveSiusResults, fetchLiveSiusMixedTeamResults, mixedTeamIdentity, MIXED_TEAM_CODES } from "@shootermarkt/adapters/sius/public-adapter";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";
import type { MixedTeamEntry } from "@/app/(site)/(admin)/admin/rezultati/_shared/MixedTeamReviewTable";
import { buildSiusFinalDetails } from "@/lib/final-detail";
import { matchShooter } from "@shootermarkt/db/name-match";

const SUPPORTED_CODES = ["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW"] as const;

export interface SiusFinalEntry {
  disciplineCode: string;
  rank: number;
  firstName: string;
  lastName: string;
  nation: string;
  total: number;
  inners: number | null;
  series: number[];
  siusAthleteId: string | null;
  skip?: boolean;
}

export class SiusImportError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Fetches SIUS public results for a competition UUID and shapes them as review rows (no DB writes). */
export async function buildSiusImport(siusId: string, disciplineCodes?: string[]) {
  const requested = disciplineCodes ?? [...SUPPORTED_CODES, ...MIXED_TEAM_CODES];
  const codes = requested.filter((c) => (SUPPORTED_CODES as readonly string[]).includes(c));
  const mixedCodes = requested.filter((c) => MIXED_TEAM_CODES.has(c));

  const allShooters = await db
    .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
    .from(shooters);

  let siusData: Awaited<ReturnType<typeof fetchLiveSiusResults>> = new Map();
  if (codes.length > 0) {
    try {
      siusData = await fetchLiveSiusResults(siusId, codes);
    } catch (e) {
      throw new SiusImportError(`SIUS fetch failed: ${e}`, 502);
    }
  }

  let mixedData: Awaited<ReturnType<typeof fetchLiveSiusMixedTeamResults>> = new Map();
  if (mixedCodes.length > 0) {
    try {
      mixedData = await fetchLiveSiusMixedTeamResults(siusId, mixedCodes);
    } catch (e) {
      throw new SiusImportError(`SIUS mixed-team fetch failed: ${e}`, 502);
    }
  }

  if (siusData.size === 0 && mixedData.size === 0) {
    throw new SiusImportError("No results found for this competition UUID", 404);
  }

  const rows: ReviewRow[] = [];
  const finalEntries: SiusFinalEntry[] = [];
  const errors: string[] = [];

  for (const [disciplineCode, data] of siusData) {
    const code = disciplineCode as ReviewRow["disciplineCode"];

    if (data.qual.length === 0 && data.elim.length === 0) {
      errors.push(`${disciplineCode}: no results`);
      continue;
    }

    // Qual rows
    const discRows: ReviewRow[] = [];
    for (const r of data.qual) {
      const match = matchShooter(r.firstName, r.lastName, r.nation, allShooters);
      const shooterId = match.kind === "exact" ? match.id : undefined;

      discRows.push({
        shooterId,
        issfId: r.siusAthleteId ?? undefined,
        firstName: r.firstName,
        lastName: r.lastName,
        teamNoc: r.nation,
        disciplineCode: code,
        category: "senior",
        qualTotal: r.total,
        qualInners: r.inners,
        qualRank: r.rank,
        qualSeries: r.series.length > 0 ? r.series : undefined,
        qualified: null,
        remark: r.remark,
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
          if (data.qual.length > 0) continue; // qual exists but shooter not found — skip
          const match = matchShooter(e.firstName, e.lastName, e.nation, allShooters);
          const shooterId = match.kind === "exact" ? match.id : undefined;
          row = {
            shooterId,
            issfId: e.siusAthleteId ?? undefined,
            firstName: e.firstName,
            lastName: e.lastName,
            teamNoc: e.nation,
            disciplineCode: code,
            category: "senior",
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
          row.elimTotal = Math.round(e.total);
          row.elimInners = e.inners;
          row.elimRank = e.rank;
          row.elimSeries = e.series.length > 0 ? e.series.map(Math.round) : null;
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
        rank: f.rank,
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
  for (const [disciplineCodeRaw, data] of mixedData) {
    const disciplineCode = disciplineCodeRaw as MixedTeamEntry["disciplineCode"];
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
        qualRank: r.rank,
        qualTotal: r.total,
        inners: r.inners,
        qualRemark: r.remark,
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
        existing.finalTotal = r.total;
        existing.finalRemark = r.remark;
        existing.mFinalSeries = r.athletes[0]?.series ?? [];
        existing.fFinalSeries = r.athletes[1]?.series ?? [];
      } else {
        const [a1, a2] = r.athletes;
        byKey.set(key, {
          skip: false,
          nocCode: r.nocCode,
          teamNumber: nextTeamNumber(r.nocCode),
          disciplineCode,
          qualRank: null,
          qualTotal: null,
          inners: null,
          qualRemark: null,
          qualified: true,
          finalRank: r.rank,
          finalTotal: r.total,
          finalRemark: r.remark,
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

  return { rows, finalEntries, teamEntries, eventCount: siusData.size + mixedData.size, errors };
}

/** Merges SIUS finals into qualification rows (shared by admin UI and CLI import). */
export function mergeSiusFinals(rows: ReviewRow[], finalEntries: SiusFinalEntry[]): ReviewRow[] {
  const activeFinals = finalEntries.filter((f) => !f.skip);

  // Isti oblik kao live cron: kumulativ po seriji discipline + nazivi kolona + plasman posle
  // svake serije (lib/final-detail.ts), umesto čistih zbirova serija.
  const finalFields = new Map<SiusFinalEntry, Pick<ReviewRow, "finalCumulative" | "finalSeriesLabels" | "finalRanks">>();
  for (const code of new Set(activeFinals.map((f) => f.disciplineCode))) {
    const finalists = activeFinals.filter((f) => f.disciplineCode === code && f.series.length > 0).sort((a, b) => a.rank - b.rank);
    buildSiusFinalDetails(code, finalists).forEach((detail, i) => finalFields.set(finalists[i], {
      finalCumulative: detail.cumulative ?? null,
      finalSeriesLabels: detail.seriesLabels ?? null,
      finalRanks: detail.ranks ?? null,
    }));
  }
  const mergedRows = rows.map((r) => {
    const f = activeFinals.find(
      (fe) => fe.disciplineCode === r.disciplineCode && (
        (fe.siusAthleteId && fe.siusAthleteId === r.issfId) ||
        (fe.lastName.toLowerCase() === r.lastName.toLowerCase() &&
         fe.firstName.toLowerCase() === r.firstName.toLowerCase())
      )
    );
    if (!f) return r;
    return {
      ...r,
      qualified: true,
      finalTotal: f.total,
      finalRank: f.rank,
      ...finalFields.get(f),
    };
  });

  // A final can be published before its qualification table reaches SIUS.
  // Keep it importable instead of leaving this visible review row uncommitted.
  for (const f of activeFinals) {
    const matched = mergedRows.some((r) =>
      f.disciplineCode === r.disciplineCode && (
        (f.siusAthleteId && f.siusAthleteId === r.issfId) ||
        (f.lastName.toLowerCase() === r.lastName.toLowerCase() &&
         f.firstName.toLowerCase() === r.firstName.toLowerCase())
      )
    );
    if (!matched) {
      mergedRows.push({
        issfId: f.siusAthleteId ?? undefined,
        firstName: f.firstName,
        lastName: f.lastName,
        teamNoc: f.nation,
        disciplineCode: f.disciplineCode as ReviewRow["disciplineCode"],
        category: "senior",
        qualTotal: null,
        qualInners: null,
        qualified: true,
        finalTotal: f.total,
        finalRank: f.rank,
        ...finalFields.get(f),
      });
    }
  }

  return mergedRows;
}
