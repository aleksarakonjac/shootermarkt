import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

/** Partial update of live-result sources only (the full PATCH overwrites every field). */
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { siusId, issfId } = (await req.json()) as { siusId?: string | null; issfId?: string | null };
  const set: { siusId?: string | null; issfId?: string | null } = {};
  if (siusId !== undefined) set.siusId = siusId?.trim() || null;
  if (issfId !== undefined) set.issfId = issfId?.trim() || null;
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Nema izmena" }, { status: 400 });

  try {
    const [updated] = await db.update(competitions).set(set).where(eq(competitions.id, compId)).returning({ id: competitions.id });
    if (!updated) return NextResponse.json({ error: "Nije pronađeno" }, { status: 404 });
  } catch (e) {
    // unique constraint on scius_id / issf_id
    if ((e as { code?: string; cause?: { code?: string } }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505") {
      return NextResponse.json({ error: "Taj ID već koristi drugo takmičenje" }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = revalidatesPublicSite(handlePATCH);
