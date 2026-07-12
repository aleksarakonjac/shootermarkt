import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pdfImportJobs } from "@/lib/db/schema";
import { parsePdfImport } from "@/lib/pdf-import/parse-import";
import { downloadPdfImport, removePdfImports, uploadPdfImport } from "@/lib/pdf-import/storage";
import { inngest } from "./client";
import { randomUUID } from "crypto";

const PDF_RETENTION_DAYS = 30;

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
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(pdfImportJobs.id, jobId), eq(pdfImportJobs.status, "processing")));
    },
  },
  async ({ event, attempt, step }) => {
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
      .returning({
        id: pdfImportJobs.id,
        pdfData: pdfImportJobs.pdfData,
        pdfStoragePath: pdfImportJobs.pdfStoragePath,
        sourceUrl: pdfImportJobs.sourceUrl,
      });
    if (!job) return { skipped: true };

    const pdfStoragePath = job.pdfStoragePath ?? await step.run("download-source-pdf", async () => {
      if (job.pdfData) return null;
      if (!job.sourceUrl) throw new Error("Originalni PDF više nije dostupan");

      const response = await fetch(job.sourceUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!response.ok) throw new Error(`Preuzimanje izvornog PDF-a nije uspelo: HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > 20 * 1024 * 1024) throw new Error("Izvorni PDF je veći od 20 MB");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength < 100 || buffer.byteLength > 20 * 1024 * 1024) throw new Error("Izvorni PDF je neispravan ili veći od 20 MB");

      const path = `imports/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.pdf`;
      await uploadPdfImport(path, buffer);
      try {
        await db.update(pdfImportJobs)
          .set({ pdfStoragePath: path, updatedAt: new Date() })
          .where(eq(pdfImportJobs.id, job.id));
      } catch (error) {
        await removePdfImports([path]).catch(() => undefined);
        throw error;
      }
      return path;
    });
    const pdfData = pdfStoragePath
      ? await downloadPdfImport(pdfStoragePath)
      : job.pdfData;
    if (!pdfData) throw new Error("Originalni PDF više nije dostupan");

    const result = await parsePdfImport(pdfData);
    await db.update(pdfImportJobs)
      .set({ status: "completed", result, completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pdfImportJobs.id, job.id), eq(pdfImportJobs.status, "processing")));
    return { jobId: job.id, rows: result.rows.length };
  }
);

export const cleanupExpiredPdfImports = inngest.createFunction(
  {
    id: "cleanup-expired-pdf-imports",
    triggers: [{ cron: "0 3 * * *" }],
  },
  async () => {
    const expiresBefore = new Date(Date.now() - PDF_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const jobs = await db
      .select({ id: pdfImportJobs.id, pdfStoragePath: pdfImportJobs.pdfStoragePath })
      .from(pdfImportJobs)
      .where(and(
        inArray(pdfImportJobs.status, ["completed", "failed"]),
        isNull(pdfImportJobs.pdfDeletedAt),
        lt(pdfImportJobs.completedAt, expiresBefore),
        or(isNotNull(pdfImportJobs.pdfStoragePath), isNotNull(pdfImportJobs.pdfData)),
      ))
      .limit(100);

    const paths = jobs.flatMap((job) => job.pdfStoragePath ? [job.pdfStoragePath] : []);
    await removePdfImports(paths);

    if (jobs.length > 0) {
      await db.update(pdfImportJobs)
        .set({ pdfData: null, pdfDeletedAt: new Date(), updatedAt: new Date() })
        .where(inArray(pdfImportJobs.id, jobs.map((job) => job.id)));
    }

    return { deleted: jobs.length };
  }
);
