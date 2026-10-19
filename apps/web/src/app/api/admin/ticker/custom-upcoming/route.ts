import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { tickerCustomUpcoming } from "@shootermarkt/db/schema";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { text, date, href, displayUntil } = body;

  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const [entry] = await db.insert(tickerCustomUpcoming).values({
    text: text.trim(),
    date: date || null,
    href: href || null,
    displayUntil: displayUntil || null,
  }).returning();

  revalidatePath("/", "layout");
  return NextResponse.json(entry, { status: 201 });
}
