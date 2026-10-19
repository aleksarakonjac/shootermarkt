import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { issfDirectImportJobs } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });
  const [job] = await db.select().from(issfDirectImportJobs).where(eq(issfDirectImportJobs.id, id));
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Job nije pronađen" }, { status: 404 });
}
