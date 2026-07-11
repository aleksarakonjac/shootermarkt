import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pdfImportJobs } from "@/lib/db/schema";
import { parsePdfImport } from "@/lib/pdf-import/parse-import";
import { inngest } from "./client";

export const processPdfImport = inngest.createFunction(
  {
    id: "process-pdf-import",
    retries: 3,
    triggers: [{ event: "pdf-import/queued" }],
    onFailure: async ({ event, error }) => {
      const jobId = Number(event.data.event.data.jobId);
      if (!Number.isInteger(jobId)) return;

      await db.update(pdfImportJobs)
        .set({
          status: "failed",
          error: error.message,
          updatedAt: new Date(),
        })
        .where(and(eq(pdfImportJobs.id, jobId), eq(pdfImportJobs.status, "processing")));
    },
  },
  async ({ event, attempt }) => {
    const jobId = event.data.jobId;
    const status = attempt === 0 ? "queued" : "processing";
    const update = {
      attempts: sql`${pdfImportJobs.attempts} + 1`,
      updatedAt: new Date(),
      ...(attempt === 0 ? { status: "processing", startedAt: new Date() } : {}),
    };

    const [job] = await db.update(pdfImportJobs)
      .set(update)
      .where(and(eq(pdfImportJobs.id, jobId), eq(pdfImportJobs.status, status)))
      .returning({ id: pdfImportJobs.id, pdfData: pdfImportJobs.pdfData });
    if (!job) return { skipped: true };

    const result = await parsePdfImport(job.pdfData);
    await db.update(pdfImportJobs)
      .set({ status: "completed", result, completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pdfImportJobs.id, job.id), eq(pdfImportJobs.status, "processing")));
    return { jobId: job.id, rows: result.rows.length };
  }
);
