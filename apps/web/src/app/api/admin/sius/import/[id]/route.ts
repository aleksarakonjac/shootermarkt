import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { siusImportJobs } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";

async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user?.email && user.email === process.env.ADMIN_EMAIL;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });
  const [job] = await db.select().from(siusImportJobs).where(eq(siusImportJobs.id, id));
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Job nije pronađen" }, { status: 404 });
}
