import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { issfRefreshJobs } from "@shootermarkt/db/schema";
import { queueIssfRefreshJob } from "@/lib/issf/jobs";
import { requireAdmin } from "@/lib/admin-auth";

// GET: poslednji refresh job (UI nastavlja praćenje posle reload-a)
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const [job] = await db.select().from(issfRefreshJobs).orderBy(desc(issfRefreshJobs.id)).limit(1);
  return NextResponse.json(job ?? null);
}

// POST: pokreni refresh (ili vrati već aktivan)
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const job = await queueIssfRefreshJob();
    return job ? NextResponse.json(job, { status: 202 }) : NextResponse.json({ error: "Nema strelaca za osvežavanje" }, { status: 409 });
  } catch (e) {
    console.error("[issf/refresh-jobs] queue failed:", e);
    return NextResponse.json({ error: `Pokretanje ISSF refresh-a nije uspelo: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}
