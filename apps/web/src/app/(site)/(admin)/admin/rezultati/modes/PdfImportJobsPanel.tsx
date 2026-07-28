"use client";

import { useCallback, useEffect, useState } from "react";

type JobStatus = "queued" | "processing" | "completed" | "failed";
type Filter = "all" | "active" | "completed" | "failed";

export interface PdfImportJobSummary {
  id: number;
  competitionId: number;
  competitionName: string;
  status: JobStatus;
  error: string | null;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pdfDeletedAt: string | null;
}

interface PdfImportJobsPanelProps {
  refreshToken: number;
  onOpenCompleted: (job: PdfImportJobSummary) => void;
  onRetryStarted: (jobId: number) => void;
}

const STATUS: Record<JobStatus, { label: string; className: string }> = {
  queued: { label: "Na čekanju", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  processing: { label: "U obradi", className: "bg-blue-50 text-blue-800 ring-blue-200" },
  completed: { label: "Uspešan", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  failed: { label: "Greška", className: "bg-red-50 text-red-800 ring-red-200" },
};

const DATE_FORMATTER = new Intl.DateTimeFormat("sr-RS", {
  dateStyle: "medium",
  timeStyle: "short",
});

function isActive(status: JobStatus) {
  return status === "queued" || status === "processing";
}

export function PdfImportJobsPanel({ refreshToken, onOpenCompleted, onRetryStarted }: PdfImportJobsPanelProps) {
  const [jobs, setJobs] = useState<PdfImportJobSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const loadJobs = useCallback(async () => {
    const response = await fetch("/api/admin/import/jobs");
    const data = await response.json() as { jobs?: PdfImportJobSummary[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Učitavanje poslova nije uspelo");
    setJobs(data.jobs ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        await loadJobs();
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadJobs, refreshToken]);

  useEffect(() => {
    if (!jobs.some((job) => isActive(job.status))) return;
    const interval = window.setInterval(() => void loadJobs().catch(() => undefined), 2500);
    return () => window.clearInterval(interval);
  }, [jobs, loadJobs]);

  async function retry(jobId: number) {
    setRetryingId(jobId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/import/jobs/${jobId}/retry`, { method: "POST" });
      const data = await response.json() as { id?: number; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Ponovno pokretanje nije uspelo");
      onRetryStarted(data.id);
      await loadJobs();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : String(retryError));
    } finally {
      setRetryingId(null);
    }
  }

  const visibleJobs = jobs.filter((job) => {
    if (filter === "active") return isActive(job.status);
    return filter === "all" || job.status === filter;
  });

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">PDF poslovi</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Poslovi ostaju sačuvani i nastavljaju se bez otvorene stranice. Originalni PDF se briše nakon 30 dana.</p>
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
          className="rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)]"
          aria-label="Filtriraj PDF poslove"
        >
          <option value="all">Svi poslovi</option>
          <option value="active">U toku</option>
          <option value="completed">Uspešni</option>
          <option value="failed">Sa greškom</option>
        </select>
      </div>

      {error ? <p className="px-5 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Takmičenje</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Pokrenut</th>
              <th className="px-4 py-3 font-medium">Pokušaji</th>
              <th className="px-5 py-3 text-right font-medium">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-[var(--muted)]">Učitavanje poslova...</td></tr>
            ) : null}
            {!loading && visibleJobs.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-[var(--muted)]">Nema PDF poslova u ovom prikazu.</td></tr>
            ) : null}
            {!loading ? visibleJobs.map((job) => {
              const status = STATUS[job.status];
              return (
                <tr key={job.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="max-w-64 px-5 py-3">
                    <p className="truncate font-medium text-[var(--ink)]" title={job.competitionName}>{job.competitionName}</p>
                    {job.error ? <p className="mt-1 line-clamp-1 text-xs text-red-700" title={job.error}>{job.error}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${status.className}`}>{status.label}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">{DATE_FORMATTER.format(new Date(job.createdAt))}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">{job.attempts}</td>
                  <td className="px-5 py-3 text-right">
                    {job.status === "completed" ? (
                      <button onClick={() => onOpenCompleted(job)} className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">Otvori pregled</button>
                    ) : null}
                    {job.status === "failed" && !job.pdfDeletedAt ? (
                      <button onClick={() => void retry(job.id)} disabled={retryingId === job.id} className="text-xs font-semibold text-[var(--brand-primary)] hover:underline disabled:opacity-50">
                        {retryingId === job.id ? "Pokrećem..." : "Pokušaj ponovo"}
                      </button>
                    ) : null}
                    {job.status === "failed" && job.pdfDeletedAt ? <span className="text-xs text-[var(--muted)]">Izvor obrisan</span> : null}
                    {isActive(job.status) ? <span className="text-xs text-[var(--muted)]">Obrada u toku</span> : null}
                  </td>
                </tr>
              );
            }) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
