import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { shooters, results } from "@shootermarkt/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { eq } from "drizzle-orm";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const shooterId = parseInt(id);
  if (isNaN(shooterId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { firstName, lastName, nationality, gender, birthYear, birthDate, clubId, previousLastNames } = body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: "Ime i prezime su obavezni" }, { status: 400 });
  }

  await db.update(shooters).set({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    previousLastNames: Array.isArray(previousLastNames)
      ? previousLastNames.map((n: string) => n.trim()).filter(Boolean)
      : null,
    nationality: nationality?.trim() || null,
    gender: gender || null,
    birthYear: birthDate
      ? new Date(birthDate).getFullYear()
      : birthYear ? parseInt(birthYear) : null,
    birthDate: birthDate || null,
    clubId: clubId ? parseInt(clubId) : null,
  }).where(eq(shooters.id, shooterId));

  return NextResponse.json({ ok: true });
}

async function handleDELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const shooterId = parseInt(id);
  if (isNaN(shooterId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Block delete if shooter has results
  const [existing] = await db.select({ id: results.id }).from(results).where(eq(results.shooterId, shooterId)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Strelac ima rezultate, ne može se obrisati" }, { status: 409 });
  }

  await db.delete(shooters).where(eq(shooters.id, shooterId));
  return NextResponse.json({ ok: true });
}

export const PATCH = revalidatesPublicSite(handlePATCH);
export const DELETE = revalidatesPublicSite(handleDELETE);
