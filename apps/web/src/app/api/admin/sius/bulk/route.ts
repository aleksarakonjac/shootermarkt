import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions, mixedTeamResults, results } from "@shootermarkt/db/schema";
import { fetchSiusCompetitions } from "@shootermarkt/adapters/sius/public-adapter";
import { requireAdmin } from "@/lib/admin-auth";
import { importSiusCompetition } from "@/lib/sius-bulk";
import { SiusImportError } from "@/lib/sius-import";
import { matchSiusCompetition, type SiusMatch } from "@/lib/sius-match";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

// One import commits a whole competition (hundreds of rows) — give it room.
export const maxDuration = 300;

/** Competitions of a year range (up to today) with their result counts, plus SIUS UUID suggestions for those without one. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const thisYear = new Date().getFullYear();
  const fromYear = Number(req.nextUrl.searchParams.get("from") ?? thisYear);
  const toYear = Number(req.nextUrl.searchParams.get("to") ?? thisYear);
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear > toYear) {
    return NextResponse.json({ error: "Neispravan opseg godina" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const from = `${fromYear}-01-01`;
  const to = `${toYear}-12-31` < today ? `${toYear}-12-31` : today;

  const rows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      date: competitions.date,
      dateEnd: competitions.dateEnd,
      level: competitions.level,
      location: competitions.location,
      siusId: competitions.siusId,
      resultCount: sql<number>`(select count(*)::int from ${results} where ${results}.competition_id = "competitions"."id")`,
      teamCount: sql<number>`(select count(*)::int from ${mixedTeamResults} where ${mixedTeamResults}.competition_id = "competitions"."id")`,
    })
    .from(competitions)
    .where(and(gte(competitions.date, from), lte(competitions.date, to)))
    .orderBy(competitions.date);

  const suggestions = new Map<number, SiusMatch>();
  let siusLookupFailed = false;
  const unlinked = rows.filter((r) => !r.siusId);
  if (unlinked.length) {
    try {
      const sius = await fetchSiusCompetitions(from);
      const taken = new Set((await db.select({ id: competitions.siusId }).from(competitions).where(isNotNull(competitions.siusId))).map((r) => r.id!));
      // A UUID is suggested to its best-scoring competition only, so two rows never offer the same one.
      const best = new Map<string, { compId: number; match: SiusMatch }>();
      for (const c of unlinked) {
        const match = matchSiusCompetition({ name: c.name, date: c.date, location: c.location }, sius, taken);
        // Below ~0.25 the "match" is just whatever SIUS event fell in the same days (scores of true matches start ~0.4).
        if (!match || match.score < 0.25) continue;
        const cur = best.get(match.id);
        if (!cur || match.score > cur.match.score) best.set(match.id, { compId: c.id, match });
      }
      for (const { compId, match } of best.values()) suggestions.set(compId, match);
    } catch (err) {
      console.warn("[sius-bulk] SIUS competitions lookup failed:", err);
      siusLookupFailed = true;
    }
  }

  return NextResponse.json({
    competitions: rows.map(({ location: _location, ...r }) => ({ ...r, suggestion: suggestions.get(r.id) ?? null })),
    siusLookupFailed,
  });
}

type Action =
  | { action: "preview" | "import"; competitionId: number }
  | { action: "link"; competitionId: number; siusId: string };

/** preview: what SIUS has for one competition · import: write it · link: store a SIUS UUID on a competition. */
async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json()) as Action;
  const [comp] = await db.select({ id: competitions.id, siusId: competitions.siusId }).from(competitions).where(eq(competitions.id, Number(body.competitionId)));
  if (!comp) return NextResponse.json({ error: "Takmičenje ne postoji" }, { status: 404 });

  if (body.action === "link") {
    const siusId = body.siusId?.trim();
    if (!siusId) return NextResponse.json({ error: "SIUS UUID je obavezan" }, { status: 400 });
    const [owner] = await db.select({ name: competitions.name }).from(competitions).where(and(eq(competitions.siusId, siusId), ne(competitions.id, comp.id)));
    if (owner) return NextResponse.json({ error: `SIUS UUID već koristi „${owner.name}"` }, { status: 409 });
    await db.update(competitions).set({ siusId }).where(eq(competitions.id, comp.id));
    return NextResponse.json({ ok: true });
  }

  if (!comp.siusId) return NextResponse.json({ error: "Takmičenje nema SIUS UUID" }, { status: 400 });
  try {
    return NextResponse.json(body.action === "import"
      ? await importSiusCompetition(comp.id, comp.siusId, { commit: true })
      : await importSiusCompetition(comp.id, comp.siusId));
  } catch (err) {
    if (err instanceof SiusImportError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[sius-bulk]", body.action, comp.id, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Uvoz nije uspeo" }, { status: 500 });
  }
}

export const POST = revalidatesPublicSite(handlePOST);
