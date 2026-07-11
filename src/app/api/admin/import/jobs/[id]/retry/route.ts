import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pdfImportJobs } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });

  const [job] = await db.update(pdfImportJobs)
    .set({ status: "queued", error: null, startedAt: null, completedAt: null, updatedAt: new Date() })
    .where(and(eq(pdfImportJobs.id, id), eq(pdfImportJobs.status, "failed")))
    .returning({ id: pdfImportJobs.id, status: pdfImportJobs.status });
  if (!job) return NextResponse.json({ error: "Samo neuspešan job može ponovo da se pokrene" }, { status: 409 });

  try {
    await inngest.send({ name: "pdf-import/queued", data: { jobId: job.id } });
  } catch (error) {
    await db.update(pdfImportJobs)
      .set({
        status: "failed",
        error: `Ponovno zakazivanje nije uspelo: ${error instanceof Error ? error.message : String(error)}`,
        updatedAt: new Date(),
      })
      .where(eq(pdfImportJobs.id, job.id));
    return NextResponse.json({ error: "Ponovno zakazivanje nije uspelo" }, { status: 502 });
  }

  return NextResponse.json(job, { status: 202 });
}
