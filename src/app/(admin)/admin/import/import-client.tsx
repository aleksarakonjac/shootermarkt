"use client";

import { useState, useRef } from "react";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";

type Step = "upload" | "review" | "done";

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId: number;
}

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "drzavno", label: "Državno" },
  { value: "kup", label: "Kup" },
  { value: "regionalno", label: "Regionalno" },
  { value: "medjunarodno", label: "Međunarodno" },
];

const DISCIPLINES = ["ARM", "ARW", "APM", "APW"] as const;

export function ImportClient() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload step
  const fileRef = useRef<HTMLInputElement>(null);
  const [compName, setCompName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [compLocation, setCompLocation] = useState("");
  const [compLevel, setCompLevel] = useState<CompetitionLevel>("drzavno");

  // Review step
  const [rows, setRows] = useState<ReviewRow[]>([]);

  // Done step
  const [result, setResult] = useState<CommitResult | null>(null);

  async function handleParse() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Izaberi PDF fajl"); return; }
    if (!compName || !compDate) { setError("Unesite naziv i datum takmičenja"); return; }

    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("pdf", file);

      const res = await fetch("/api/admin/import/parse", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Parse error");

      setRows(data.rows as ReviewRow[]);
      setStep("review");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
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
      setResult(data as CommitResult);
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
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8 pb-6 border-b border-[var(--border)]">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Import PDF biltena
        </h1>
        <p className="text-sm mt-1 text-[var(--muted)]">
          Uploaduj bilten → Gemini parsira → Pregledate i potvrđujete
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-xs font-semibold uppercase tracking-wider">
        {(["upload", "review", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--subtle)]">→</span>}
            <span style={{ color: step === s ? "var(--brand-primary)" : "var(--subtle)" }}>
              {i + 1}. {s === "upload" ? "Upload" : s === "review" ? "Pregled" : "Gotovo"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] p-6 space-y-4">
            <h2 className="font-semibold text-[var(--ink)]">Podaci o takmičenju</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Naziv *
                </label>
                <input
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="npr. Državno prvenstvo Srbije 2025"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Datum *
                </label>
                <input
                  type="date"
                  value={compDate}
                  onChange={(e) => setCompDate(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Nivo
                </label>
                <select
                  value={compLevel}
                  onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)}
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
                >
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Lokacija
                </label>
                <input
                  value={compLocation}
                  onChange={(e) => setCompLocation(e.target.value)}
                  placeholder="npr. Beograd, SC Crvena zvezda"
                  className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
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
            disabled={loading}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Parsiranje..." : "Parsiraj sa Gemini →"}
          </button>
        </div>
      )}

      {/* ── Step 2: Review ─────────────────────────────────────────────── */}
      {step === "review" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">{rows.filter((r) => !r.skip).length}</span> rezultata za unos
              {rows.some((r) => r.warning) && (
                <span className="ml-2 text-[var(--warning)]">
                  · {rows.filter((r) => r.warning).length} upozorenja
                </span>
              )}
            </p>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              ← Nazad
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub (NOC)</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Disc.</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Rank</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Total</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inners</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors ${row.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!row.skip}
                        onChange={(e) => updateRow(idx, { skip: e.target.checked })}
                        className="accent-[var(--brand-primary)]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.lastName}
                        onChange={(e) => updateRow(idx, { lastName: e.target.value })}
                        className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.firstName}
                        onChange={(e) => updateRow(idx, { firstName: e.target.value })}
                        className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2 text-[var(--muted)] text-xs font-[family-name:var(--font-jetbrains-mono)]">
                      {row.clubNoc ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.disciplineCode}
                        onChange={(e) => updateRow(idx, { disciplineCode: e.target.value as ReviewRow["disciplineCode"] })}
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
                        onChange={(e) => updateRow(idx, { qualTotal: parseFloat(e.target.value) })}
                        step="0.1"
                        className="w-16 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] text-sm py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">
                      {row.qualInners != null ? `${row.qualInners}x` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.shooterId ? (
                        <span className="text-xs text-[var(--success)]">✓ Pronađen</span>
                      ) : row.warning ? (
                        <span className="text-xs text-[var(--warning)]" title={row.warning}>⚠ Novi</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCommit}
              disabled={loading}
              className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Unosim..." : `Potvrdi i unesi ${rows.filter((r) => !r.skip).length} rezultata →`}
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

      {/* ── Step 3: Done ───────────────────────────────────────────────── */}
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
