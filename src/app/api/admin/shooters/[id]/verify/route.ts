import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
