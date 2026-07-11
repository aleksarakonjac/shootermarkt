"use client";

import { useEffect, useState, useRef } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";

type Step = "upload" | "review" | "done";

interface ParseResponse {
  rows: ReviewRow[];
  eventsCount: number;
  skippedDisciplines: string[];
}

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId: number;
}

interface PdfImportJob {
  id: number;
  competitionId: number;
  status: "queued" | "processing" | "completed" | "failed";
  result: ParseResponse | null;
  error: string | null;
}

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "national", label: "Državno" },
  { value: "regional", label: "Regionalno" },
  { value: "continental", label: "Kontinentalno" },
  { value: "world", label: "Svetsko" },
  { value: "club", label: "Klubsko" },
  { value: "olympic", label: "Olimpijsko" },
];

const DISCIPLINES = ["ARM", "ARW", "APM", "APW"] as const;

export function ImportClient() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [compName, setCompName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [compLocation, setCompLocation] = useState("");
  const [compLevel, setCompLevel] = useState<CompetitionLevel>("national");

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [parseInfo, setParseInfo] = useState<Omit<ParseResponse, "rows"> | null>(null);
  const [nocFilter, setNocFilter] = useState<string>("");
  const [jobId, setJobId] = useState<number | null>(null);
  const [failedJobId, setFailedJobId] = useState<number | null>(null);
  const [competitionId, setCompetitionId] = useState<number | null>(null);

  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      const res = await fetch(`/api/admin/import/jobs/${jobId}`);
      const job = (await res.json()) as PdfImportJob;
      if (!res.ok) throw new Error(job.error ?? "Job nije pronađen");

      if (job.status === "completed" && job.result) {
        setRows(job.result.rows);
        setParseInfo({
          eventsCount: job.result.eventsCount,
          skippedDisciplines: job.result.skippedDisciplines,
        });
        setCompetitionId(job.competitionId);
        setJobId(null);
        setStep("review");
      } else if (job.status === "failed") {
        setError(job.error ?? "Parsiranje nije uspelo");
        setFailedJobId(job.id);
        setJobId(null);
      }
    };

    void poll().catch((pollError) => setError(String(pollError)));
    const interval = window.setInterval(() => void poll().catch((pollError) => setError(String(pollError))), 2500);
    return () => window.clearInterval(interval);
  }, [jobId]);

  async function handleParse() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Izaberi PDF fajl"); return; }
    if (!compName || !compDate) { setError("Unesite naziv i datum takmičenja"); return; }

    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      fd.append("competitionName", compName);
      fd.append("competitionDate", compDate);
      fd.append("competitionLocation", compLocation);
      fd.append("competitionLevel", compLevel);
      fd.append("competitionEventType", "other");
      const res = await fetch("/api/admin/import/jobs", { method: "POST", body: fd });
      const data = (await res.json()) as { id?: number; competitionId?: number; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Pokretanje parsiranja nije uspelo");
      setCompetitionId(data.competitionId ?? null);
      setJobId(data.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
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
      setJobId(job.id);
    } catch (retryError) {
      setError(String(retryError));
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    setLoading(true);
    setError(null);
    const payload: CommitPayload = {
      competitionId: competitionId ?? undefined,
      competition: competitionId ? undefined : { name: compName, date: compDate, location: compLocation || undefined, level: compLevel },
      rows,
    };
    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as CommitResult;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Commit error");
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

  function skipByNoc(noc: string) {
    setRows((prev) => prev.map((r) => r.teamNoc === noc ? { ...r, skip: true } : r));
  }

  function reset() {
    setStep("upload");
    setRows([]);
    setParseInfo(null);
    setResult(null);
    setError(null);
    setNocFilter("");
    setJobId(null);
    setFailedJobId(null);
    setCompetitionId(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Unique countries in parsed results
  const allNocs = Array.from(new Set(rows.map((r) => r.teamNoc))).sort();
  const filteredRows = nocFilter ? rows.filter((r) => r.teamNoc === nocFilter) : rows;
  const activeCount = rows.filter((r) => !r.skip).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 pb-6 border-b border-[var(--border)]">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Import PDF biltena
        </h1>
        <p className="text-sm mt-1 text-[var(--muted)]">
          Uvoz rezultata iz PDF biltena i ručni pregled pred potvrdu.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          {failedJobId && (
            <button onClick={handleRetry} disabled={loading} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
              {loading ? "Pokrećem..." : "Pokušaj ponovo"}
            </button>
          )}
        </div>
      )}

      {jobId && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)]">
          PDF se obrađuje na serveru. Pregled će se otvoriti čim parsiranje završi.
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] p-6 space-y-4">
            <h2 className="font-semibold text-[var(--ink)]">Podaci o takmičenju</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Naziv *</label>
                <input
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="npr. Državno prvenstvo Srbije 2025"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum *</label>
                <DatePicker value={compDate} onChange={setCompDate} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Nivo</label>
                <select
                  value={compLevel}
                  onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                >
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Lokacija</label>
                <input
                  value={compLocation}
                  onChange={(e) => setCompLocation(e.target.value)}
                  placeholder="npr. Beograd, SC Crvena zvezda"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-sm text-[var(--muted)] mb-3">PDF bilten takmičenja</p>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" id="pdf-upload" />
            <label
              htmlFor="pdf-upload"
              className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Izaberi PDF
            </label>
            <p className="text-xs text-[var(--subtle)] mt-3">SIUS digitalni PDF, max 20MB</p>
          </div>

          <button
            onClick={handleParse}
            disabled={loading || !!jobId}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Šaljem PDF..." : jobId ? "Parsiranje u toku..." : "Parsiraj sa Gemini →"}
          </button>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <div className="space-y-5">
          {/* Stats bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span>
                <span className="font-semibold text-[var(--ink)]">{activeCount}</span> za unos
              </span>
              <span>
                <span className="font-semibold text-[var(--ink)]">{rows.filter((r) => r.skip).length}</span> preskočeno
              </span>
              {rows.filter((r) => r.warning).length > 0 && (
                <span style={{ color: "var(--warning)" }}>
                  ⚠ {rows.filter((r) => r.warning).length} novih strelaca
                </span>
              )}
              {parseInfo?.skippedDisciplines.length ? (
                <span style={{ color: "var(--warning)" }}>
                  Preskočene discipline: {parseInfo.skippedDisciplines.join(", ")}
                </span>
              ) : null}
            </div>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              ← Nazad
            </button>
          </div>

          {/* Country filter + bulk skip */}
          {allNocs.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja:</span>
              <button
                onClick={() => setNocFilter("")}
                className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: nocFilter === "" ? "var(--brand-primary)" : "var(--surface)",
                  color: nocFilter === "" ? "white" : "var(--ink)",
                }}
              >
                Sve ({rows.length})
              </button>
              {allNocs.map((noc) => {
                const count = rows.filter((r) => r.teamNoc === noc).length;
                const skipped = rows.filter((r) => r.teamNoc === noc && r.skip).length;
                return (
                  <div key={noc} className="flex items-center gap-1">
                    <button
                      onClick={() => setNocFilter(nocFilter === noc ? "" : noc)}
                      className="rounded-full px-3 py-1 text-xs font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors"
                      style={{
                        background: nocFilter === noc ? "var(--brand-accent)" : "var(--surface)",
                        color: nocFilter === noc ? "white" : "var(--ink)",
                      }}
                    >
                      {noc} ({count - skipped}/{count})
                    </button>
                    {skipped < count && (
                      <button
                        onClick={() => skipByNoc(noc)}
                        title={`Skip sve ${noc}`}
                        className="text-[0.65rem] text-[var(--subtle)] hover:text-[var(--brand-primary)] transition-colors"
                      >
                        skip sve
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-[var(--border)] overflow-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th className="px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Disc.</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Rank</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Total</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inners</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredRows.map((row, visIdx) => {
                  // Find true index in rows array
                  const trueIdx = rows.indexOf(row);
                  return (
                    <tr
                      key={visIdx}
                      className={`transition-colors ${row.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!row.skip}
                          onChange={(e) => updateRow(trueIdx, { skip: e.target.checked })}
                          className="accent-[var(--brand-primary)]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.lastName}
                          onChange={(e) => updateRow(trueIdx, { lastName: e.target.value })}
                          className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.firstName}
                          onChange={(e) => updateRow(trueIdx, { firstName: e.target.value })}
                          className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">
                          {row.teamNoc}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)] text-xs">
                        {row.clubAbbr ?? <span className="text-[var(--subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.disciplineCode}
                          onChange={(e) => updateRow(trueIdx, { disciplineCode: e.target.value as ReviewRow["disciplineCode"] })}
                          className="bg-transparent text-xs font-[family-name:var(--font-barlow-condensed)] font-semibold text-[var(--ink)] focus:outline-none"
                        >
                          {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">
                        {row.qualRank != null ? `#${row.qualRank}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={row.qualTotal}
                          onChange={(e) => updateRow(trueIdx, { qualTotal: parseFloat(e.target.value) })}
                          step="0.1"
                          className="w-16 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] text-sm py-0.5"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">
                        {row.qualInners != null ? `${row.qualInners}x` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.shooterId ? (
                          <span className="text-xs" style={{ color: "var(--success)" }}>✓ Pronađen</span>
                        ) : row.warning ? (
                          <span className="text-xs" style={{ color: "var(--warning)" }}>⚠ Novi</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCommit}
              disabled={loading || activeCount === 0}
              className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Unosim..." : `Potvrdi i unesi ${activeCount} rezultata →`}
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
            >
              Otkaži
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === "done" && result && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] p-8 text-center">
            <div
              className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-6xl mb-2"
              style={{ color: "var(--success)" }}
            >
              {result.inserted}
            </div>
            <p className="text-sm text-[var(--muted)]">
              rezultata uneto
              {result.skipped > 0 && ` · ${result.skipped} preskočeno`}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-4 text-left rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-md px-5 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              Import još jedan bilten
            </button>
            <a
              href="/admin"
              className="rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
            >
              Admin panel
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
