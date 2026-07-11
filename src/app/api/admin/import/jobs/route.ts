import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { competitions, pdfImportJobs } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { and, eq } from "drizzle-orm";
import type { CompetitionLevel, EventType } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined) { return !!email && email === process.env.ADMIN_EMAIL; }

async function resolveCompetitionId(formData: FormData) {
  const existingId = Number(formData.get("competitionId"));
  if (Number.isInteger(existingId) && existingId > 0) return existingId;

  const name = String(formData.get("competitionName") ?? "").trim();
  const date = String(formData.get("competitionDate") ?? "").trim();
  const location = String(formData.get("competitionLocation") ?? "").trim();
  const level = String(formData.get("competitionLevel") ?? "").trim() as CompetitionLevel;
  const eventType = String(formData.get("competitionEventType") ?? "other").trim() as EventType;

  if (!name || !date || !level) return null;

  const existingComp = await db.query.competitions.findFirst({
    where: and(eq(competitions.name, name), eq(competitions.date, date)),
  });
  if (existingComp) return existingComp.id;

  const [created] = await db
    .insert(competitions)
    .values({
      name,
      date,
      location: location || null,
      level,
      eventType: eventType || "other",
    })
    .returning({ id: competitions.id });
  return created.id;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("pdf") as File | null;
  if (!file || file.type !== "application/pdf") return NextResponse.json({ error: "PDF file required" }, { status: 400 });
  const competitionId = await resolveCompetitionId(formData);
  if (!competitionId) return NextResponse.json({ error: "Izaberi takmičenje ili popuni podatke" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "PDF je veći od 20 MB" }, { status: 413 });

  const [job] = await db.insert(pdfImportJobs).values({ competitionId, pdfData: Buffer.from(await file.arrayBuffer()) }).returning({ id: pdfImportJobs.id, competitionId: pdfImportJobs.competitionId, status: pdfImportJobs.status });
  await inngest.send({ name: "pdf-import/queued", data: { jobId: job.id } });
  return NextResponse.json(job, { status: 202 });
}
