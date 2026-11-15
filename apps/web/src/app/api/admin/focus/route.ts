import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions, homepageFocusOverrides } from "@shootermarkt/db/schema";
import { desc, eq, ilike, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";
import { VALID_SCOPES, type Scope } from "@/lib/scope";

/** Pretraga takmičenja za ručno dodavanje u In focus. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const rows = await db
    .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, date: competitions.date, dateEnd: competitions.dateEnd, level: competitions.level })
    .from(competitions)
    .where(or(ilike(competitions.name, like), ilike(competitions.nameSr, like), ilike(competitions.nameEn, like)))
    .orderBy(desc(competitions.date))
    .limit(10);
  return NextResponse.json(rows);
}

type Item = { competitionId: number; position: number | null; hidden: boolean; collapsed: boolean };

/** Zamenjuje ceo ručni izbor za jedan scope. Prazan niz = vrati na automatski. */
async function handlePUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json() as { scope?: string; items?: Item[] };
  const scope = body.scope as Scope;
  if (!VALID_SCOPES.includes(scope) || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "scope i items su obavezni" }, { status: 400 });
  }
  const seen = new Set<number>();
  const rows: Array<typeof homepageFocusOverrides.$inferInsert> = [];
  for (const it of body.items) {
    if (!Number.isInteger(it.competitionId) || seen.has(it.competitionId)) {
      return NextResponse.json({ error: "Neispravno ili duplirano takmičenje" }, { status: 400 });
    }
    seen.add(it.competitionId);
    if (it.position != null && !Number.isInteger(it.position)) return NextResponse.json({ error: "Neispravna pozicija" }, { status: 400 });
    rows.push({ scope, competitionId: it.competitionId, position: it.hidden ? null : it.position, hidden: !!it.hidden, collapsed: !!it.collapsed });
  }

  await db.transaction(async (tx) => {
    await tx.delete(homepageFocusOverrides).where(eq(homepageFocusOverrides.scope, scope));
    if (rows.length) await tx.insert(homepageFocusOverrides).values(rows);
  });
  return NextResponse.json({ ok: true });
}

export const PUT = revalidatesPublicSite(handlePUT);
