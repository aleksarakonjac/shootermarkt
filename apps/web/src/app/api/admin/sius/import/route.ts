import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { siusImportJobs } from "@shootermarkt/db/schema";
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
  const { guid, events, name } = body as {
    guid: string;
    events: string[]; // e.g. ["ARM", "ARW", "APM", "APW"]
    name: string;
  };

  if (!guid || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "guid and events required" }, { status: 400 });
  }

  const [job] = await db.insert(siusImportJobs)
    .values({ input: { guid, events, name } })
    .returning({ id: siusImportJobs.id });

  try {
    await inngest.send({ name: "sius-import/queued", data: { jobId: job.id } });
  } catch (error) {
    return NextResponse.json({
      error: `Pokretanje SIUS importa nije uspelo: ${error instanceof Error ? error.message : String(error)}`,
    }, { status: 502 });
  }

  return NextResponse.json({ id: job.id }, { status: 202 });
}
