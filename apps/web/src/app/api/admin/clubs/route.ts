import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@shootermarkt/db";
import { clubs } from "@shootermarkt/db/schema";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { name, city } = await req.json() as { name: string; city?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Naziv je obavezan" }, { status: 400 });

  const [club] = await db
    .insert(clubs)
    .values({ name: name.trim(), city: city?.trim() || null })
    .returning({ id: clubs.id, name: clubs.name });

  return NextResponse.json(club);
}
