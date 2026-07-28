import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { createClient } from "@/lib/supabase/server";
import { inArray, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { ids?: number[]; all?: boolean };

  if (body.all) {
    const result = await db
      .update(shooters)
      .set({ verified: true })
      .where(eq(shooters.verified, false))
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
