import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyIssfProfile, IssfConflictError } from "@shootermarkt/adapters/issf/sync";

// POST { issfId } → poveže strelca sa ISSF (ili osveži već povezanog) i popuni prazna polja.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || user.email !== process.env.ADMIN_EMAIL) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Neispravan strelac" }, { status: 400 });
  const { issfId } = await req.json().catch(() => ({})) as { issfId?: string };
  if (!issfId) return NextResponse.json({ error: "issfId je obavezan" }, { status: 400 });

  try {
    return NextResponse.json({ updated: await applyIssfProfile(id, issfId.trim()) });
  } catch (e) {
    if (e instanceof IssfConflictError) return NextResponse.json({ error: e.message, shooterId: e.shooterId }, { status: 409 });
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
