"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";

type Step = "select" | "review" | "done";

interface ISSFCompetition {
  id: number;
  name: string;
  dateFrom: string;
  dateTo: string;
  city: string;
  nationCode: string;
  nationName: string;
}

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId: number;
}

const DISCIPLINES = ["ARM", "ARW", "APM", "APW"] as const;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "world",         label: "ISSF–Svetsko" },
  { value: "continental",   label: "Kontinentalno (ESC)" },
  { value: "international", label: "Međunarodno" },
  { value: "national",      label: "Državno" },
  { value: "regional",      label: "Regionalno" },
  { value: "club",          label: "Klubsko (liga)" },
  { value: "olympic",       label: "Olimpijsko" },
];

export function ISSFImportClient() {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [competitions, setCompetitions] = useState<ISSFCompetition[]>([]);
  const [competitionsLoaded, setCompetitionsLoaded] = useState(false);
  const [selectedComp, setSelectedComp] = useState<ISSFCompetition | null>(null);

  const [compLevel, setCompLevel] = useState<CompetitionLevel>("world");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [nocFilter, setNocFilter] = useState("");

  const [result, setResult] = useState<CommitResult | null>(null);

  async function loadCompetitions() {
    setLoading(true);
    setError(null);
    setCompetitionsLoaded(false);
    try {
      const res = await fetch(`/api/admin/issf/competitions?year=${year}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load competitions");
      setCompetitions(data);
      setCompetitionsLoaded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!selectedComp) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/issf/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: selectedComp.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setRows(data.rows);
      setEventCount(data.eventCount);
      setStep("review");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!selectedComp) return;
    setLoading(true);
    setError(null);
    const payload: CommitPayload = {
      competition: {
        name: selectedComp.name,
        date: selectedComp.dateFrom.split("T")[0],
        location: selectedComp.city,
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
    setRows((prev) => prev.map((r) => (r.teamNoc === noc ? { ...r, skip: true } : r)));
  }

  function reset() {
    setStep("select");
    setSelectedComp(null);
    setRows([]);
    setResult(null);
    setError(null);
    setNocFilter("");
  }

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
          ISSF Import
        </h1>
        <p className="text-sm mt-1 text-[var(--muted)]">
          Uvoz rezultata sa issf-sports.org — automatski preuzima PDF-ove i parsira ih
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-xs font-semibold uppercase tracking-wider">
        {(["select", "review", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--subtle)]">→</span>}
            <span style={{ color: step === s ? "var(--brand-primary)" : "var(--subtle)" }}>
              {i + 1}.{" "}
              {s === "select" ? "Odabir" : s === "review" ? "Pregled" : "Gotovo"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Step 1: Select competition ── */}
      {step === "select" && (
        <div className="space-y-6">
          {/* Year picker + load */}
          <div className="rounded-xl border border-[var(--border)] p-6 space-y-4">
            <h2 className="font-semibold text-[var(--ink)]">Odaberi godinu i nivo</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Godina
                </label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(parseInt(e.target.value));
                    setCompetitionsLoaded(false);
                    setCompetitions([]);
                    setSelectedComp(null);
                  }}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Nivo
                </label>
                <select
                  value={compLevel}
                  onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                >
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadCompetitions}
                disabled={loading}
                className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Učitavam..." : "Učitaj takmičenja"}
              </button>
            </div>
          </div>

          {/* Competition list */}
          {competitionsLoaded && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              {competitions.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--muted)]">
                  Nema Rifle/Pistol takmičenja za {year}.
                </div>
              ) : (
                <>
                  <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {competitions.length} takmičenja · klikni za odabir
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {competitions.map((c) => {
                      const isSelected = selectedComp?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedComp(isSelected ? null : c)}
                          className="w-full text-left px-4 py-3 flex items-start justify-between gap-4 transition-colors hover:bg-[var(--surface)]"
                          style={{
                            background: isSelected ? "var(--brand-primary-light)" : undefined,
                          }}
                        >
                          <div>
                            <p className="font-semibold text-sm text-[var(--ink)]">{c.name}</p>
                            <p className="text-xs text-[var(--muted)] mt-0.5">
                              {c.city}, {c.nationName}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                              {c.dateFrom.split("T")[0]}
                            </p>
                            <p className="text-xs text-[var(--subtle)] mt-0.5">{c.nationCode}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {selectedComp && (
            <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary-light)]">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--ink)]">{selectedComp.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {selectedComp.dateFrom.split("T")[0]} · {selectedComp.city}
                </p>
              </div>
              <button
                onClick={handleImport}
                disabled={loading}
                className="shrink-0 rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Preuzimam PDF-ove..." : "Uvezi rezultate →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span>
                <span className="font-semibold text-[var(--ink)]">{eventCount}</span> discipline
              </span>
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
            </div>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              ← Nazad
            </button>
          </div>

          {/* Country filter */}
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
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Disc.</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Rank</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Total</th>
                  <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inners</th>
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredRows.map((row, visIdx) => {
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
                      <td className="px-3 py-2">
                        <select
                          value={row.disciplineCode}
                          onChange={(e) =>
                            updateRow(trueIdx, {
                              disciplineCode: e.target.value as ReviewRow["disciplineCode"],
                            })
                          }
                          className="bg-transparent text-xs font-[family-name:var(--font-barlow-condensed)] font-semibold text-[var(--ink)] focus:outline-none"
                        >
                          {DISCIPLINES.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">
                        {row.qualRank != null ? `#${row.qualRank}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={row.qualTotal}
                          onChange={(e) =>
                            updateRow(trueIdx, { qualTotal: parseFloat(e.target.value) })
                          }
                          step="0.1"
                          className="w-16 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] text-sm py-0.5"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">
                        {row.qualInners != null ? `${row.qualInners}x` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.shooterId ? (
                          <span className="text-xs" style={{ color: "var(--success)" }}>
                            ✓ Pronađen
                          </span>
                        ) : row.warning ? (
                          <span className="text-xs" style={{ color: "var(--warning)" }}>
                            ⚠ Novi
                          </span>
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
              rezultata uneto{result.skipped > 0 ? ` · ${result.skipped} preskočeno` : ""}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-4 text-left rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-md px-5 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              Uvezi još jedno takmičenje
            </button>
            <Link
              href="/admin"
              className="rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
            >
              Admin panel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
