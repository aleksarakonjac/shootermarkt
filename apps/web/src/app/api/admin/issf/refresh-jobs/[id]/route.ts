import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { issfRefreshJobs } from "@shootermarkt/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

async function getId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = await getId(params);
  if (!id) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });
  const [job] = await db.select().from(issfRefreshJobs).where(eq(issfRefreshJobs.id, id));
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Job nije pronađen" }, { status: 404 });
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = await getId(params);
  if (!id) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });
  const [job] = await db.update(issfRefreshJobs)
    .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(issfRefreshJobs.id, id), inArray(issfRefreshJobs.status, ["queued", "processing"])))
    .returning({ id: issfRefreshJobs.id, status: issfRefreshJobs.status });
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Job nije aktivan" }, { status: 409 });
}
