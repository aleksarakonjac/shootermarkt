import { NextRequest, NextResponse } from "next/server";
import { and, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { buildCompetitionScopeFilter, DEFAULT_SCOPE, type Scope, VALID_SCOPES } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year"));
  const month = Number(request.nextUrl.searchParams.get("month"));
  const requestedScope = request.nextUrl.searchParams.get("scope");
  const scope: Scope = VALID_SCOPES.includes(requestedScope as Scope) ? requestedScope as Scope : DEFAULT_SCOPE;
  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "sr";

  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const startedAt = performance.now();
  const rows = await db
    .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn, date: competitions.date, dateEnd: competitions.dateEnd, location: competitions.location, level: competitions.level })
    .from(competitions)
    .where(and(sql`${competitions.date} < ${end} AND COALESCE(${competitions.dateEnd}, ${competitions.date}) >= ${start}`, buildCompetitionScopeFilter(scope)))
    .orderBy(asc(competitions.date));

  return NextResponse.json(rows.map((competition) => ({
    id: competition.id,
    name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name),
    date: competition.date,
    endDate: competition.dateEnd ?? null,
    location: competition.location,
    level: competition.level,
  })), {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Server-Timing": `calendar-db;dur=${(performance.now() - startedAt).toFixed(1)}`,
    },
  });
}
