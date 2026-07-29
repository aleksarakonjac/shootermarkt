import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { issfDirectImportJobs, issfImportJobs, pdfImportJobs, shooters, clubs } from "@shootermarkt/db/schema";
import { importIssfNation } from "@shootermarkt/adapters/issf/import-nation";
import {
  extractMixedTeamEvents,
  extractMvpEvents,
  fetchCompetitionResults,
  fetchFinalResultsFromHtml,
  fetchMixedTeamFinalFromHtml,
  fetchMixedTeamQualFromHtml,
  fetchQualResultsFromHtml,
  fetchR3PResultsFromHtml,
} from "@shootermarkt/adapters/issf/adapter";
import { NOC_LIST } from "@shootermarkt/db/noc-list";
import { matchShooter } from "@shootermarkt/db/name-match";
import { parsePdfImport } from "@shootermarkt/adapters/pdf-import/parse-import";
import { downloadPdfImport, removePdfImports, uploadPdfImport } from "@shootermarkt/adapters/pdf-import/storage";
import { deriveFinalRankProgression, type ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { inngest } from "@shootermarkt/queue";
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

export const processIssfImport = inngest.createFunction(
  {
    id: "process-issf-import",
    retries: 2,
    triggers: [{ event: "issf-import/queued" }, { event: "issf-import/next" }],
    onFailure: async ({ event, error }) => {
      const jobId = Number(event.data.event.data.jobId);
      if (Number.isInteger(jobId)) {
        await db.update(issfImportJobs).set({ status: "failed", error: error.message, completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(issfImportJobs.id, jobId), eq(issfImportJobs.status, "processing")));
      }
    },
  },
  async ({ event }) => {
    const jobId = event.data.jobId;
    const [job] = await db.select().from(issfImportJobs).where(eq(issfImportJobs.id, jobId));
    if (!job || job.status === "cancelled" || job.status === "completed") return { skipped: true };

    const noc = NOC_LIST[job.current]?.noc;
    if (!noc) {
      await db.update(issfImportJobs).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(issfImportJobs.id, jobId));
      return { completed: true };
    }

    await db.update(issfImportJobs).set({ status: "processing", currentNoc: noc, startedAt: job.startedAt ?? new Date(), updatedAt: new Date() })
      .where(and(eq(issfImportJobs.id, jobId), eq(issfImportJobs.status, job.status)));
    const result = await importIssfNation(noc);
    const current = job.current + 1;
    const [updated] = await db.update(issfImportJobs)
      .set({
        current,
        inserted: sql`${issfImportJobs.inserted} + ${result.inserted}`,
        skipped: sql`${issfImportJobs.skipped} + ${result.skipped}`,
        status: current === job.total ? "completed" : "processing",
        completedAt: current === job.total ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(issfImportJobs.id, jobId), eq(issfImportJobs.status, "processing"), eq(issfImportJobs.current, job.current)))
      .returning({ status: issfImportJobs.status });
    if (updated?.status === "processing") await inngest.send({ name: "issf-import/next", data: { jobId } });
    return { noc, current, total: job.total };
  }
);

export const processIssfDirectImport = inngest.createFunction(
  {
    id: "process-issf-direct-import",
    retries: 2,
    triggers: [{ event: "issf-direct-import/queued" }],
    onFailure: async ({ event, error }) => {
      const jobId = Number(event.data.event.data.jobId);
      if (!Number.isInteger(jobId)) return;
      await db.update(issfDirectImportJobs)
        .set({ status: "failed", error: error.message, completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(issfDirectImportJobs.id, jobId), eq(issfDirectImportJobs.status, "processing")));
    },
  },
  async ({ event }) => {
    const jobId = event.data.jobId;
    const [job] = await db.update(issfDirectImportJobs)
      .set({ status: "processing", startedAt: new Date(), updatedAt: new Date(), attempts: sql`${issfDirectImportJobs.attempts} + 1` })
      .where(and(eq(issfDirectImportJobs.id, jobId), inArray(issfDirectImportJobs.status, ["queued", "processing"])))
      .returning();
    if (!job) return { skipped: true };

    const { competitionId, disciplineCodes } = job.input;
    const codeFilter = disciplineCodes?.length ? new Set(disciplineCodes) : null;

    const groups = await fetchCompetitionResults(competitionId);
    let mvpEvents = extractMvpEvents(groups);
    let mixedEvents = extractMixedTeamEvents(groups);
    if (codeFilter) {
      mvpEvents = mvpEvents.filter((e) => codeFilter.has(e.disciplineCode));
      mixedEvents = mixedEvents.filter((e) => codeFilter.has(e.disciplineCode));
    }

    if (mvpEvents.length === 0 && mixedEvents.length === 0) {
      await db.update(issfDirectImportJobs)
        .set({ status: "failed", error: "No supported events found in this competition", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(issfDirectImportJobs.id, job.id));
      return { failed: true };
    }

    const allShooters = await db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
      .from(shooters);

    const rows: ReviewRow[] = [];

    for (const { disciplineCode, category, qualPhase, finalPhase, elimPhases } of mvpEvents) {
      const isR3P = disciplineCode === "R3PM" || disciplineCode === "R3PW";

      if (isR3P) {
        const relayPhases = elimPhases.filter((ep) => ep.phase.resultKey);
        if (relayPhases.length === 0) continue;

        const allR3P: Awaited<ReturnType<typeof fetchR3PResultsFromHtml>> = [];
        for (const { phase } of relayPhases) {
          try {
            const relay = await fetchR3PResultsFromHtml(competitionId, phase.resultKey!);
            allR3P.push(...relay);
          } catch { continue; }
        }
        if (allR3P.length === 0) continue;

        allR3P.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
        allR3P.forEach((r, idx) => { r.rank = idx + 1; });

        for (const result of allR3P) {
          const match = matchShooter(result.firstName, result.lastName, result.nationCode, allShooters);
          const shooterId = match.kind === "exact" ? match.id : undefined;
          rows.push({
            shooterId,
            issfId: result.issfId || undefined,
            firstName: result.firstName,
            lastName: result.lastName,
            teamNoc: result.nationCode,
            disciplineCode,
            category,
            qualTotal: result.total,
            qualInners: result.inners,
            qualRank: result.rank,
            qualPositions: { kneeling: result.kneeling, prone: result.prone, standing: result.standing },
            qualified: result.qualified,
            remark: result.remark,
            finalTotal: null,
            finalRank: null,
            warning: shooterId ? undefined : "Novi strelac — biće kreiran",
          });
        }
        continue;
      }

      if (!qualPhase?.resultKey) continue;

      let qualResults;
      try {
        qualResults = await fetchQualResultsFromHtml(competitionId, qualPhase.resultKey);
      } catch {
        continue;
      }

      const discRows: typeof rows = [];

      for (const result of qualResults) {
        const match = matchShooter(result.firstName, result.lastName, result.nationCode, allShooters);
        const shooterId = match.kind === "exact" ? match.id : undefined;

        discRows.push({
          shooterId,
          issfId: result.issfId || undefined,
          firstName: result.firstName,
          lastName: result.lastName,
          teamNoc: result.nationCode,
          disciplineCode,
          category,
          qualTotal: result.total,
          qualInners: result.inners,
          qualRank: result.rank,
          qualSeries: result.series,
          qualified: result.qualified,
          remark: result.remark,
          finalTotal: null,
          finalRank: null,
          warning: shooterId ? undefined : "Novi strelac — biće kreiran",
        });
      }

      if (finalPhase?.resultKey) {
        try {
          const finalResults = await fetchFinalResultsFromHtml(competitionId, finalPhase.resultKey);
          const allCumulatives = finalResults.map((f) => f.stageCumulatives);

          for (const finalist of finalResults) {
            const row = discRows.find(
              (r) => r.lastName.toLowerCase() === finalist.lastName.toLowerCase() && r.firstName.toLowerCase() === finalist.firstName.toLowerCase()
            );
            if (!row) continue;

            row.finalRank = finalist.rank;
            row.finalTotal = finalist.total;
            row.finalCumulative = finalist.stageCumulatives;
            row.finalRanks = deriveFinalRankProgression(finalist.stageCumulatives, allCumulatives);
            row.finalShotsByStage = finalist.shotsByStage;
            row.finalShootOff = finalist.shootOff || null;
            row.finalScoring = disciplineCode.startsWith("AP") ? "hit_count" : "decimal";
            row.qualified = true;
          }
        } catch {
          // Finals may not be published yet — non-fatal
        }
      }

      rows.push(...discRows);
    }

    type MixedEntry = {
      skip: boolean; nocCode: string; teamNumber: number; disciplineCode: string;
      qualRank: number | null; qualTotal: number | null; inners: number | null;
      qualified: boolean; finalRank: number | null; finalTotal: number | null;
      mIssfId: string | null; mLastName: string; mFirstName: string; m_series: number[]; mInners: number | null; mTotal: number;
      fIssfId: string | null; fLastName: string; fFirstName: string; f_series: number[]; fInners: number | null; fTotal: number;
    };

    const mixedEntries: MixedEntry[] = [];
    const mixedErrors: string[] = [];

    for (const { disciplineCode, qualPhase, finalPhase } of mixedEvents) {
      const entries: MixedEntry[] = [];
      const nocCounts = new Map<string, number>();

      if (qualPhase?.resultKey) {
        try {
          const qualRows = await fetchMixedTeamQualFromHtml(competitionId, qualPhase.resultKey);
          for (const r of qualRows) {
            const teamNumber = (nocCounts.get(r.nocCode) ?? 0) + 1;
            nocCounts.set(r.nocCode, teamNumber);
            entries.push({
              skip: false, nocCode: r.nocCode, teamNumber, disciplineCode,
              qualRank: r.rank, qualTotal: r.total, inners: r.inners, qualified: r.qualified,
              finalRank: null, finalTotal: null,
              mIssfId: r.mIssfId, mLastName: r.mLastName, mFirstName: r.mFirstName, m_series: r.mSeries, mInners: r.mInners, mTotal: r.mTotal,
              fIssfId: r.fIssfId, fLastName: r.fLastName, fFirstName: r.fFirstName, f_series: r.fSeries, fInners: r.fInners, fTotal: r.fTotal,
            });
          }
        } catch (e) { mixedErrors.push(`${disciplineCode} qual: ${e}`); }
      }

      if (finalPhase?.resultKey) {
        try {
          const finalRows = await fetchMixedTeamFinalFromHtml(competitionId, finalPhase.resultKey);
          for (const r of finalRows) {
            const ex = entries.find(
              (e) => e.nocCode === r.nocCode && ((r.mIssfId && e.mIssfId === r.mIssfId) || (r.fIssfId && e.fIssfId === r.fIssfId))
            );
            if (ex) {
              ex.finalRank = r.rank; ex.finalTotal = r.total;
              if (r.mIssfId && !ex.mIssfId) ex.mIssfId = r.mIssfId;
              if (r.mLastName && !ex.mLastName) { ex.mLastName = r.mLastName; ex.mFirstName = r.mFirstName; }
              if (r.fIssfId && !ex.fIssfId) ex.fIssfId = r.fIssfId;
              if (r.fLastName && !ex.fLastName) { ex.fLastName = r.fLastName; ex.fFirstName = r.fFirstName; }
            } else {
              const teamNumber = (nocCounts.get(r.nocCode) ?? 0) + 1;
              nocCounts.set(r.nocCode, teamNumber);
              entries.push({
                skip: false, nocCode: r.nocCode, teamNumber, disciplineCode,
                qualRank: null, qualTotal: null, inners: null, qualified: true,
                finalRank: r.rank, finalTotal: r.total,
                mIssfId: r.mIssfId, mLastName: r.mLastName, mFirstName: r.mFirstName, m_series: [], mInners: null, mTotal: 0,
                fIssfId: r.fIssfId, fLastName: r.fLastName, fFirstName: r.fFirstName, f_series: [], fInners: null, fTotal: 0,
              });
            }
          }
        } catch (e) { mixedErrors.push(`${disciplineCode} final: ${e}`); }
      }

      mixedEntries.push(...entries);
    }

    await db.update(issfDirectImportJobs)
      .set({
        status: "completed",
        result: { rows, mixedEntries, eventCount: mvpEvents.length + mixedEvents.length, mixedErrors },
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(issfDirectImportJobs.id, job.id));
    return { jobId: job.id, eventCount: mvpEvents.length + mixedEvents.length };
  }
);
