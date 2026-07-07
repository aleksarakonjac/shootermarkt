import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { tickerCustomUpcoming } from "@/lib/db/schema";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { text, date, href, displayUntil } = body;

  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const [entry] = await db.insert(tickerCustomUpcoming).values({
    text: text.trim(),
    date: date || null,
    href: href || null,
    displayUntil: displayUntil || null,
  }).returning();

  return NextResponse.json(entry, { status: 201 });
}
