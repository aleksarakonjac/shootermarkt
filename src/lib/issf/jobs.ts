import { db } from "@/lib/db";
import { issfImportJobs } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { NOC_LIST } from "@/lib/noc-list";
import { eq } from "drizzle-orm";

export async function queueIssfImportJob() {
  const [job] = await db.insert(issfImportJobs).values({ total: NOC_LIST.length }).returning({ id: issfImportJobs.id });
  try {
    await inngest.send({ name: "issf-import/queued", data: { jobId: job.id } });
  } catch (error) {
    await db.update(issfImportJobs).set({ status: "failed", error: String(error), completedAt: new Date(), updatedAt: new Date() }).where(eq(issfImportJobs.id, job.id));
    throw error;
  }
  return job;
}
