import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { issfImportJobs } from "@shootermarkt/db/schema";

async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user?.email && user.email === process.env.ADMIN_EMAIL;
}

async function getId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await getId(params);
  if (!id) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });
  const [job] = await db.select().from(issfImportJobs).where(eq(issfImportJobs.id, id));
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Job nije pronađen" }, { status: 404 });
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await getId(params);
  if (!id) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });
  const [job] = await db.update(issfImportJobs)
    .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(issfImportJobs.id, id), inArray(issfImportJobs.status, ["queued", "processing"])))
    .returning({ id: issfImportJobs.id, status: issfImportJobs.status });
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Job nije aktivan" }, { status: 409 });
}
