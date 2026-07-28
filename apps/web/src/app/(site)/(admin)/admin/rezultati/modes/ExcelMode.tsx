"use client";

import { useRef, useState } from "react";
import type { CommitPayload, ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { DonePanel } from "../_shared/DonePanel";
import { ReviewTable } from "../_shared/ReviewTable";

type Step = "upload" | "review" | "done";

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId: number;
}

type ImportedCompetition = NonNullable<CommitPayload["competition"]> & { dateEnd?: string };

export function ExcelMode() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [competitionId, setCompetitionId] = useState<number | undefined>();
  const [competition, setCompetition] = useState<ImportedCompetition | undefined>();
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  async function parseFile() {
    if (!file) {
      setError("Izaberi popunjen .xlsx fajl.");
      return;
    }

    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/import/excel/parse", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setWarnings(data.errors ?? []);
        throw new Error(data.error ?? "Excel import nije uspeo.");
      }
      setRows(data.rows);
      setWarnings(data.errors ?? []);
      setCompetitionId(data.competitionId);
      setCompetition(data.competition);
      setStep("review");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    const activeRows = rows.filter((row) => !row.skip);
    if (activeRows.length === 0) {
      setError("Nema rezultata za unos.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: CommitPayload = { source: "manual", competitionId, competition, rows: activeRows };
      const response = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upis rezultata nije uspeo.");
      setResult(data);
      setStep("done");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setError(null);
    setWarnings([]);
    setRows([]);
    setCompetitionId(undefined);
    setCompetition(undefined);
    setNocFilter("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const activeCount = rows.filter((row) => !row.skip).length;

  if (step === "done" && result) {
    return <DonePanel result={result} onReset={reset} resetLabel="Uvezi još jedan Excel" />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="rounded-xl border border-[var(--border)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink)]">Excel fajl rezultata</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Preuzmi šablon, ostavi nepoznate vrednosti prazne i ne menjaj zaglavlja kolona.</p>
            </div>
            <a
              href="/api/admin/import/excel/template"
              download
              className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface)]"
            >
              Preuzmi šablon .xlsx
            </a>
          </div>

          <label className="mt-5 flex min-h-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 text-center transition-colors hover:border-[var(--brand-primary)]">
            <span>
              <span className="block text-sm font-semibold text-[var(--ink)]">{file ? file.name : "Izaberi .xlsx fajl"}</span>
              <span className="mt-1 block text-xs text-[var(--muted)]">Maksimalna veličina fajla je 5 MB</span>
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={parseFile}
              disabled={!file || loading}
              className="rounded-md bg-[var(--brand-primary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Proveravam…" : "Pregledaj rezultate"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--ink)]">
                {competitionId ? `Postojeće takmičenje #${competitionId}` : competition?.name}
              </p>
              {competition && (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {competition.date}{competition.location ? ` · ${competition.location}` : ""} · {competition.level}
                </p>
              )}
            </div>
            <button onClick={reset} className="text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]">
              Učitaj drugi fajl
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-semibold">Redovi sa greškom nisu uvezeni u pregled</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {warnings.slice(0, 12).map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
              {warnings.length > 12 && <p className="mt-1 text-xs">Još {warnings.length - 12} grešaka.</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
            <span><span className="font-semibold text-[var(--ink)]">{activeCount}</span> za unos</span>
            <span><span className="font-semibold text-[var(--ink)]">{rows.filter((row) => row.skip).length}</span> preskočeno</span>
            {rows.some((row) => row.warning) && <span className="text-[var(--warning)]">Proveri nove ili predložene strelce</span>}
          </div>

          <ReviewTable
            rows={rows}
            nocFilter={nocFilter}
            onRowChange={(idx, patch) => setRows((previous) => previous.map((row, index) => index === idx ? { ...row, ...patch } : row))}
            onNocFilterChange={setNocFilter}
            onSkipNoc={(noc) => setRows((previous) => previous.map((row) => row.teamNoc === noc ? { ...row, skip: true } : row))}
          />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={commit}
              disabled={loading || activeCount === 0}
              className="rounded-md bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Upisujem…" : `Potvrdi i unesi ${activeCount} rezultata`}
            </button>
            <button onClick={reset} className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface)]">
              Otkaži
            </button>
          </div>
        </>
      )}
    </div>
  );
}
