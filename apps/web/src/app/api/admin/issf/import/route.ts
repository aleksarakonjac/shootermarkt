import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@shootermarkt/db";
import { issfDirectImportJobs } from "@shootermarkt/db/schema";
import { inngest } from "@shootermarkt/queue";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const competitionId = parseInt(body.competitionId);
  if (isNaN(competitionId)) {
    return NextResponse.json({ error: "competitionId required" }, { status: 400 });
  }
  const disciplineCodes: string[] | undefined = body.disciplineCodes;

  const [job] = await db.insert(issfDirectImportJobs)
    .values({ input: { competitionId, disciplineCodes } })
    .returning({ id: issfDirectImportJobs.id });

  try {
    await inngest.send({ name: "issf-direct-import/queued", data: { jobId: job.id } });
  } catch (error) {
    return NextResponse.json({
      error: `Pokretanje ISSF importa nije uspelo: ${error instanceof Error ? error.message : String(error)}`,
    }, { status: 502 });
  }

  return NextResponse.json({ id: job.id }, { status: 202 });
}
