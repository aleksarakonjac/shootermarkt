import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { and, inArray, eq } from "drizzle-orm";
import { buildShootersWhere, type ShooterFilterParams } from "@/lib/admin-shooters-filter";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json() as { ids?: number[]; all?: boolean; filter?: ShooterFilterParams };

  if (body.all) {
    const result = await db
      .update(shooters)
      .set({ verified: true })
      .where(and(eq(shooters.verified, false), body.filter ? buildShootersWhere(body.filter) : undefined))
      .returning({ id: shooters.id });
    return NextResponse.json({ verified: result.length });
  }

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Nema ID-ova" }, { status: 400 });
  }

  await db
    .update(shooters)
    .set({ verified: true })
    .where(inArray(shooters.id, ids));

  return NextResponse.json({ verified: ids.length });
}

export const POST = revalidatesPublicSite(handlePOST);
