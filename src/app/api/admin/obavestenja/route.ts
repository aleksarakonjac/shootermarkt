import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { calendarAlerts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const showAll = req.nextUrl.searchParams.get("all") === "1";

  const rows = await db
    .select()
    .from(calendarAlerts)
    .where(showAll ? undefined : eq(calendarAlerts.seen, false))
    .orderBy(desc(calendarAlerts.createdAt));

  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, seen } = await req.json() as { ids: number[]; seen: boolean };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  for (const id of ids) {
    await db.update(calendarAlerts).set({ seen }).where(eq(calendarAlerts.id, id));
  }

  return NextResponse.json({ updated: ids.length });
}
