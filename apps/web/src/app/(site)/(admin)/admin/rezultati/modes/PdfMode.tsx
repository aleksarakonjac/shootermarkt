"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

import type { ReviewRow, CommitPayload } from "@shootermarkt/db/pdf-import-types";
import { CompetitionSearchSelect } from "@/components/ui/CompetitionSearchSelect";
import { ReviewTable } from "../_shared/ReviewTable";
import { NewShootersPanel } from "../_shared/NewShootersPanel";
import { DonePanel } from "../_shared/DonePanel";
import { PdfImportJobsPanel, type PdfImportJobSummary } from "./PdfImportJobsPanel";

type Step = "upload" | "review" | "done";


interface ParseInfo { eventsCount: number; skippedDisciplines: string[]; matchedFinals?: number; unmatchedFinals?: number }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }
interface PdfImportJob { id: number; competitionId: number; tags: string[]; status: "queued" | "processing" | "completed" | "failed"; result: { rows: ReviewRow[]; eventsCount: number; skippedDisciplines: string[]; matchedFinals?: number; unmatchedFinals?: number } | null; error: string | null }

export function PdfMode() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [selectedCompName, setSelectedCompName] = useState("");
  const [importTags, setImportTags] = useState<string[]>([]);
  const [failedJobId, setFailedJobId] = useState<number | null>(null);
  const [jobsRefreshToken, setJobsRefreshToken] = useState(0);
  const [jobId, setJobId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const savedJobId = Number(localStorage.getItem("pdfImportJobId"));
    return Number.isInteger(savedJobId) && savedJobId > 0 ? savedJobId : null;
  });

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [parseInfo, setParseInfo] = useState<ParseInfo | null>(null);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      const response = await fetch(`/api/admin/import/jobs/${jobId}`);
      const job = await response.json() as PdfImportJob;
      if (!response.ok) throw new Error(job.error ?? "Job nije pronađen");
      if (job.status === "completed" && job.result) {
        setRows(job.result.rows);
        setParseInfo({
          eventsCount: job.result.eventsCount,
          skippedDisciplines: job.result.skippedDisciplines,
          matchedFinals: job.result.matchedFinals,
          unmatchedFinals: job.result.unmatchedFinals,
        });
        setSelectedCompId(job.competitionId);
        setImportTags(job.tags);
        localStorage.removeItem("pdfImportJobId");
        setJobId(null);
        setJobsRefreshToken((token) => token + 1);
        setStep("review");
      } else if (job.status === "failed") {
        setError(job.error ?? "Parsiranje nije uspelo");
        setFailedJobId(job.id);
        localStorage.removeItem("pdfImportJobId");
        setJobId(null);
        setJobsRefreshToken((token) => token + 1);
      }
    };
    void poll().catch((pollError) => setError(String(pollError)));
    const interval = window.setInterval(() => void poll().catch((pollError) => setError(String(pollError))), 2500);
    return () => window.clearInterval(interval);
  }, [jobId]);

  async function handleParse() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Izaberi PDF fajl"); return; }
    if (!selectedCompId) { setError("Izaberi takmičenje iz baze"); return; }
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      fd.append("competitionId", String(selectedCompId));
      const res = await fetch("/api/admin/import/jobs", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pokretanje parsiranja nije uspelo");
      startTrackingJob(data.id);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleRetry() {
    if (!failedJobId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/import/jobs/${failedJobId}/retry`, { method: "POST" });
      const job = await response.json() as { id?: number; error?: string };
      if (!response.ok || !job.id) throw new Error(job.error ?? "Ponovno pokretanje nije uspelo");
      setFailedJobId(null);
      startTrackingJob(job.id);
    } catch (retryError) {
      setError(String(retryError));
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!selectedCompId) { setError("Izaberi takmičenje iz baze"); return; }
    setLoading(true);
    setError(null);
    const payload: CommitPayload = { competitionId: selectedCompId, tags: importTags, rows };
    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Commit error");
      setResult(data);
      setStep("done");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(idx: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function startTrackingJob(nextJobId: number) {
    localStorage.setItem("pdfImportJobId", String(nextJobId));
    setJobId(nextJobId);
    setJobsRefreshToken((token) => token + 1);
  }

  async function openCompletedJob(jobSummary: PdfImportJobSummary) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/import/jobs/${jobSummary.id}`);
      const job = await response.json() as PdfImportJob;
      if (!response.ok) throw new Error(job.error ?? "Job nije pronađen");
      if (job.status !== "completed" || !job.result) throw new Error("Rezultat ovog posla još nije dostupan");
      setRows(job.result.rows);
      setParseInfo({
        eventsCount: job.result.eventsCount,
        skippedDisciplines: job.result.skippedDisciplines,
        matchedFinals: job.result.matchedFinals,
        unmatchedFinals: job.result.unmatchedFinals,
      });
      setSelectedCompId(job.competitionId);
      setSelectedCompName(jobSummary.competitionName);
      setImportTags(job.tags);
      setFailedJobId(null);
      setStep("review");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setRows([]);
    setParseInfo(null);
    setResult(null);
    setError(null);
    setNocFilter("");
    setSelectedFile(null);
    setSelectedCompId(null);
    setSelectedCompName("");
    setImportTags([]);
    setFailedJobId(null);
    setJobId(null);
    localStorage.removeItem("pdfImportJobId");
    if (fileRef.current) fileRef.current.value = "";
  }

  const activeCount = rows.filter((r) => !r.skip).length;

  if (step === "done" && result) {
    return <DonePanel result={result} onReset={reset} resetLabel="Import još jedan PDF" />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          {failedJobId && (
            <button onClick={handleRetry} disabled={loading} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
              {loading ? "Pokrećem..." : "Pokušaj ponovo"}
            </button>
          )}
        </div>
      )}

      {jobId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)]">
          PDF se obrađuje na serveru. Možeš slobodno da osvežiš stranicu ili pređeš na drugu stranu.
        </div>
      )}

      {step === "upload" && (
        <>
          {/* Competition picker */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] p-6 space-y-3">
            <h2 className="font-semibold text-[var(--ink)]">Takmičenje</h2>
            <CompetitionSearchSelect
              value={selectedCompId}
              onChange={(competition) => { setSelectedCompId(competition.id); setSelectedCompName(competition.nameSr || competition.name); }}
            />
            <p className="text-xs text-[var(--muted)]">
              Rezultati iz PDF-a vezuju se za izabrano takmičenje. Ako ga nema, prvo ga
              kreiraj u <Link href="/admin/takmicenja" className="text-[var(--brand-primary)] hover:underline">Takmičenja</Link>.
            </p>
          </div>

          {/* File upload */}
          <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto mb-3 text-[var(--border-strong)]" aria-hidden="true">
              <path d="M6 26h20M16 6v14M10 12l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm font-medium text-[var(--ink)] mb-1">
              {selectedFile ? selectedFile.name : "PDF bilten takmičenja"}
            </p>
            <p className="text-xs text-[var(--subtle)] mb-4">
              {selectedFile
                ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB · SIUS digitalni PDF`
                : "SIUS digitalni PDF, max 20MB"}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              id="pdf-file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="pdf-file"
              className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
            >
              {selectedFile ? "Promeni fajl" : "Izaberi PDF"}
            </label>
          </div>

          <button
            onClick={handleParse}
            disabled={loading || !!jobId || !selectedCompId || !selectedFile}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Šaljem PDF…" : jobId ? "Parsiranje u toku…" : "Parsiraj sa Gemini →"}
          </button>
        </div>
        </>
      )}

      {step === "review" && (
        <>
          {/* Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              {parseInfo && (
                <span><span className="font-semibold text-[var(--ink)]">{parseInfo.eventsCount}</span> discipline</span>
              )}
              <span><span className="font-semibold text-[var(--ink)]">{activeCount}</span> za unos</span>
              <span><span className="font-semibold text-[var(--ink)]">{rows.filter(r => r.skip).length}</span> preskočeno</span>
              {(parseInfo?.matchedFinals ?? 0) > 0 && <span><span className="font-semibold text-[var(--ink)]">{parseInfo?.matchedFinals}</span> finala povezano</span>}
              {(parseInfo?.unmatchedFinals ?? 0) > 0 && <span style={{ color: "var(--warning)" }}>{parseInfo?.unmatchedFinals} finala bez kvalifikacionog reda</span>}
              {rows.filter(r => r.warning).length > 0 && (
                <span style={{ color: "var(--warning)" }}>⚠ {rows.filter(r => r.warning).length} novih strelaca</span>
              )}
              {parseInfo?.skippedDisciplines.length ? (
                <span style={{ color: "var(--warning)" }}>Preskočene: {parseInfo.skippedDisciplines.join(", ")}</span>
              ) : null}
            </div>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              ← Nazad
            </button>
          </div>

          {selectedCompName && (
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 text-sm">
              <span className="text-[var(--muted)]">Takmičenje: </span>
              <span className="font-semibold text-[var(--ink)]">{selectedCompName}</span>
            </div>
          )}

          <NewShootersPanel rows={rows} onRowChange={updateRow} />

          <ReviewTable
            rows={rows}
            nocFilter={nocFilter}
            onRowChange={updateRow}
            onNocFilterChange={setNocFilter}
            onSkipNoc={(noc) => setRows(prev => prev.map(r => r.teamNoc === noc ? { ...r, skip: true } : r))}
          />

          <div className="flex gap-3">
            <button
              onClick={handleCommit}
              disabled={loading || activeCount === 0}
              className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Unosim…" : `Potvrdi i unesi ${activeCount} rezultata →`}
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
            >
              Otkaži
            </button>
          </div>
        </>
      )}

      <PdfImportJobsPanel
        refreshToken={jobsRefreshToken}
        onOpenCompleted={(job) => void openCompletedJob(job)}
        onRetryStarted={startTrackingJob}
      />
    </div>
  );
}
