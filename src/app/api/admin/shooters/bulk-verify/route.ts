import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await req.json() as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Nema ID-ova" }, { status: 400 });
  }

  await db
    .update(shooters)
    .set({ verified: true })
    .where(inArray(shooters.id, ids));

  return NextResponse.json({ verified: ids.length });
}
