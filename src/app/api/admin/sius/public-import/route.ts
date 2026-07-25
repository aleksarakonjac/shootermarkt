import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchLiveSiusResults } from "@/lib/sius/public-adapter";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import type { ReviewRow } from "@/lib/pdf-import/types";
import { matchShooter } from "@/lib/name-match";

const SUPPORTED_CODES = ["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW", "RFPM"] as const;

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

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { siusId, disciplineCodes } = body as {
    siusId: string;
    disciplineCodes?: string[];
  };

  if (!siusId?.trim()) {
    return NextResponse.json({ error: "siusId required" }, { status: 400 });
  }

  const codes = (disciplineCodes ?? [...SUPPORTED_CODES]).filter((c) =>
    (SUPPORTED_CODES as readonly string[]).includes(c)
  );

  const allShooters = await db
    .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
    .from(shooters);

  let siusData;
  try {
    siusData = await fetchLiveSiusResults(siusId, codes);
  } catch (e) {
    return NextResponse.json({ error: `SIUS fetch failed: ${e}` }, { status: 502 });
  }

  if (siusData.size === 0) {
    return NextResponse.json({ error: "No results found for this competition UUID" }, { status: 404 });
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
            qualRank: null,
            qualified: null,
            finalTotal: null,
            finalRank: null,
            warning: shooterId ? undefined : "Novi strelac — biće kreiran",
          };
          discRows.push(row);
        }
        if (row.elimRound == null || round > row.elimRound) {
          row.elimRound = round;
          row.elimTotal = e.total;
          row.elimRank = e.rank;
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

  return NextResponse.json({ rows, finalEntries, eventCount: siusData.size, errors });
}
