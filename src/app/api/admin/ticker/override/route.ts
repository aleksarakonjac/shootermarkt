import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { tickerLiveOverrides } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { competitionId, label, customSlides, priority } = body;

  const [override] = await db.insert(tickerLiveOverrides).values({
    competitionId: competitionId ?? null,
    isActive: true,
    label: label ?? null,
    customSlides: customSlides ?? null,
    priority: priority ?? 0,
  }).returning();

  return NextResponse.json(override, { status: 201 });
}
