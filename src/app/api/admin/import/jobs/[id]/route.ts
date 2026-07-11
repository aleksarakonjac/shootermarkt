import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { pdfImportJobs } from "@/lib/db/schema";

function isAdmin(email: string | undefined) { return !!email && email === process.env.ADMIN_EMAIL; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Neispravan job" }, { status: 400 });
  const [job] = await db.select({ id: pdfImportJobs.id, competitionId: pdfImportJobs.competitionId, status: pdfImportJobs.status, result: pdfImportJobs.result, error: pdfImportJobs.error, attempts: pdfImportJobs.attempts, createdAt: pdfImportJobs.createdAt, completedAt: pdfImportJobs.completedAt }).from(pdfImportJobs).where(eq(pdfImportJobs.id, id));
  if (!job) return NextResponse.json({ error: "Job nije pronađen" }, { status: 404 });
  return NextResponse.json(job);
}
