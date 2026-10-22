import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

/** Partial update (club, gender, birth year, verified) — the full PATCH overwrites every field. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const shooterId = parseInt((await params).id);
  if (isNaN(shooterId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { clubId, gender, birthYear, verified } = (await req.json()) as {
    clubId?: number | null; gender?: string | null; birthYear?: number | null; verified?: boolean;
  };
  const set: Partial<typeof shooters.$inferInsert> = {};
  if (clubId !== undefined) set.clubId = clubId ? Number(clubId) : null;
  if (gender !== undefined) {
    if (gender && gender !== "M" && gender !== "F") return NextResponse.json({ error: "Neispravan pol" }, { status: 400 });
    set.gender = gender || null;
  }
  if (birthYear !== undefined) {
    const y = birthYear ? Number(birthYear) : null;
    if (y !== null && (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear())) {
      return NextResponse.json({ error: "Neispravna godina rođenja" }, { status: 400 });
    }
    set.birthYear = y;
  }
  if (verified !== undefined) set.verified = !!verified;
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Nema izmena" }, { status: 400 });

  const [updated] = await db.update(shooters).set(set).where(eq(shooters.id, shooterId)).returning({ id: shooters.id });
  if (!updated) return NextResponse.json({ error: "Nije pronađeno" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
