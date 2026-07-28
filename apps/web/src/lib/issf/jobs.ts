import { db } from "@shootermarkt/db";
import { issfImportJobs } from "@shootermarkt/db/schema";
import { inngest } from "@shootermarkt/queue";
import { NOC_LIST } from "@shootermarkt/db/noc-list";
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
