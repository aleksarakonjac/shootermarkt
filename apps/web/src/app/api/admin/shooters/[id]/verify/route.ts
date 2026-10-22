import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

async function handlePOST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const shooterId = parseInt(id);

  if (isNaN(shooterId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await db
    .update(shooters)
    .set({ verified: true })
    .where(eq(shooters.id, shooterId));

  return NextResponse.json({ ok: true });
}

export const POST = revalidatesPublicSite(handlePOST);
