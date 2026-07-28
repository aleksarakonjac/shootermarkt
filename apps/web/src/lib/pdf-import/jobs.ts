import { db } from "@shootermarkt/db";
import { pdfImportJobs } from "@shootermarkt/db/schema";
import { inngest } from "@shootermarkt/queue";
import { eq } from "drizzle-orm";

interface QueuePdfImportJobInput {
  competitionId: number;
  pdfStoragePath?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
}

export async function queuePdfImportJob(input: QueuePdfImportJobInput) {
  const [job] = await db.insert(pdfImportJobs)
    .values({
      competitionId: input.competitionId,
      pdfStoragePath: input.pdfStoragePath,
      sourceUrl: input.sourceUrl,
      sourceLabel: input.sourceLabel,
      tags: input.tags ?? [],
    })
    .returning({ id: pdfImportJobs.id, competitionId: pdfImportJobs.competitionId, status: pdfImportJobs.status });

  try {
    await inngest.send({ name: "pdf-import/queued", data: { jobId: job.id } });
  } catch (error) {
    await db.update(pdfImportJobs)
      .set({
        status: "failed",
        error: `Zakazivanje importa nije uspelo: ${error instanceof Error ? error.message : String(error)}`,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pdfImportJobs.id, job.id));
    throw error;
  }

  return job;
}
