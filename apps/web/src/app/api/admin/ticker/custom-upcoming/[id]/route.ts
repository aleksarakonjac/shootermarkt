import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { tickerCustomUpcoming } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await db.delete(tickerCustomUpcoming).where(eq(tickerCustomUpcoming.id, parseInt(id)));
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
