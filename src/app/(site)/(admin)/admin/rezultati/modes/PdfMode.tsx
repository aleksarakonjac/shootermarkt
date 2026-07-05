"use client";

import { useState, useRef } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";
import { ReviewTable } from "../_shared/ReviewTable";
import { DonePanel } from "../_shared/DonePanel";

type Step = "upload" | "review" | "done";

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "national",    label: "Državno"           },
  { value: "regional",    label: "Regionalno"        },
  { value: "continental", label: "Kontinentalno"     },
  { value: "world",       label: "Svetsko"           },
  { value: "club",        label: "Klubsko"           },
  { value: "olympic",     label: "Olimpijsko"        },
];

interface ParseInfo { eventsCount: number; skippedDisciplines: string[] }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

export function PdfMode() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compName, setCompName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [compLocation, setCompLocation] = useState("");
  const [compLevel, setCompLevel] = useState<CompetitionLevel>("national");

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [parseInfo, setParseInfo] = useState<ParseInfo | null>(null);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  async function handleParse() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Izaberi PDF fajl"); return; }
    if (!compName || !compDate) { setError("Naziv i datum su obavezni"); return; }
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/admin/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse error");
      setRows(data.rows);
      setParseInfo({ eventsCount: data.eventsCount, skippedDisciplines: data.skippedDisciplines });
      setStep("review");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    setLoading(true);
    setError(null);
    const payload: CommitPayload = {
      competition: {
        name: compName,
        date: compDate,
        location: compLocation || undefined,
        level: compLevel,
      },
      rows,
    };
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

  function reset() {
    setStep("upload");
    setRows([]);
    setParseInfo(null);
    setResult(null);
    setError(null);
    setNocFilter("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const activeCount = rows.filter((r) => !r.skip).length;

  if (step === "done" && result) {
    return <DonePanel result={result} onReset={reset} resetLabel="Import još jedan PDF" />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === "upload" && (
        <>
          {/* Competition metadata */}
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
                <DatePicker value={compDate} onChange={setCompDate} required />
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
            disabled={loading}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Parsiranje (Gemini)…" : "Parsiraj sa Gemini →"}
          </button>
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
    </div>
  );
}
