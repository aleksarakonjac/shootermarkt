import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { detectLang, translateText } from "@/lib/competition-translate";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

type Patch = { nameSr?: string; nameEn?: string; locationSr?: string; locationEn?: string };

/** Popunjava prazne prevode (naziv + lokacija) jednog takmičenja; postojeće ne dira. */
async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [row] = await db.select().from(competitions).where(eq(competitions.id, compId));
  if (!row) return NextResponse.json({ error: "Nije pronađeno" }, { status: 404 });

  const patch: Patch = {};
  try {
    const nameLang = detectLang(row.name);
    if (!row.nameSr) patch.nameSr = nameLang === "sr" ? row.name : await translateText(row.name, "en", "sr");
    if (!row.nameEn) patch.nameEn = nameLang === "en" ? row.name : await translateText(row.name, "sr", "en");

    if (row.location) {
      const locLang = detectLang(row.location);
      if (!row.locationSr) patch.locationSr = locLang === "sr" ? row.location : await translateText(row.location, "en", "sr", "location");
      if (!row.locationEn) patch.locationEn = locLang === "en" ? row.location : await translateText(row.location, "sr", "en", "location");
    }
  } catch (e) {
    return NextResponse.json({ error: String(e), partial: patch }, { status: 502 });
  }

  if (Object.keys(patch).length) await db.update(competitions).set(patch).where(eq(competitions.id, compId));
  return NextResponse.json({ patch });
}

/** Ručna izmena prevoda. */
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const b = await req.json();
  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const [updated] = await db
    .update(competitions)
    .set({ nameSr: clean(b.nameSr), nameEn: clean(b.nameEn), locationSr: clean(b.locationSr), locationEn: clean(b.locationEn) })
    .where(eq(competitions.id, compId))
    .returning({ id: competitions.id });
  if (!updated) return NextResponse.json({ error: "Nije pronađeno" }, { status: 404 });
  return NextResponse.json({ id: updated.id });
}

export const POST = revalidatesPublicSite(handlePOST);
export const PATCH = revalidatesPublicSite(handlePATCH);
