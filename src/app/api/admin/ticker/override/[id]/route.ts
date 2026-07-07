import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { tickerLiveOverrides } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const updates: Partial<typeof tickerLiveOverrides.$inferInsert> = {};

  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (body.customSlides !== undefined) updates.customSlides = body.customSlides;
  if (body.label !== undefined) updates.label = body.label;
  if (typeof body.priority === "number") updates.priority = body.priority;
  if (body.href !== undefined) updates.href = body.href;
  if (body.type !== undefined) updates.type = body.type;

  const [updated] = await db.update(tickerLiveOverrides)
    .set(updates)
    .where(eq(tickerLiveOverrides.id, parseInt(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(tickerLiveOverrides).where(eq(tickerLiveOverrides.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
