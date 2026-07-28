import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { issfDirectImportJobs } from "@shootermarkt/db/schema";
import { inngest } from "@shootermarkt/queue";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
