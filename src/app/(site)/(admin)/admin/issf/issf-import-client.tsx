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

// ── Finals sub-section ────────────────────────────────────────────────────────

function rankColor(rank: number | null | undefined): string {
  if (rank === 1) return "oklch(0.75 0.18 85)";   // gold
  if (rank === 2) return "oklch(0.65 0.06 250)";   // silver
  if (rank === 3) return "oklch(0.60 0.12 40)";    // bronze
  return "var(--muted)";
}

function FinalSection({ discRows, isAP }: { discRows: ReviewRow[]; isAP: boolean }) {
  const [showShots, setShowShots] = useState(false);

  const finalists = discRows
    .filter((r) => r.finalRank != null && r.finalCumulative?.length)
    .sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));

  if (finalists.length === 0) return null;

  const stageCount = Math.max(...finalists.map((f) => f.finalCumulative!.length));
  const hasShots = finalists.some((f) => f.finalShotsByStage?.some((s) => s.length > 0));

  // Max shots per stage (for row height when shots are shown)
  const maxShotsPerStage = Array.from({ length: stageCount }, (_, i) =>
    Math.max(0, ...finalists.map((f) => f.finalShotsByStage?.[i]?.length ?? 0))
  );

  const stageLabels = Array.from({ length: stageCount }, (_, i) =>
    i === 0 ? "F1" : i === 1 ? "F2" : `E${i - 1}`
  );

  const fmtScore = (v: number) => isAP ? String(v) : v.toFixed(1);

  return (
    <div className="border-t-2" style={{ borderColor: "oklch(0.75 0.18 85 / 0.25)" }}>
      {/* Finals header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface)]">
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: "oklch(0.65 0.12 85)" }}>
            ★ Finale
          </span>
          <span className="text-xs text-[var(--muted)]">
            {finalists.length} finalista · {stageCount} faza
          </span>
          {finalists.some((f) => f.finalShootOff) && (
            <span className="rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
              SO
            </span>
          )}
        </div>
        {hasShots && (
          <button
            onClick={() => setShowShots((v) => !v)}
            className="text-[0.65rem] font-semibold text-[var(--brand-primary)] hover:underline transition-colors"
          >
            {showShots ? "Sakrij hice ↑" : "Prikaži hice ↓"}
          </button>
        )}
      </div>

      {/* Finals table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: `${320 + stageCount * 64}px` }}>
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="w-8 px-2 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)]">#</th>
              <th className="min-w-[150px] px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)]">Strelac</th>
              <th className="px-2 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)]">NOC</th>
              {stageLabels.map((label, i) => (
                <th
                  key={i}
                  className="w-16 px-1 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-wider bg-[var(--surface)]"
                  style={{ color: i < 2 ? "var(--muted)" : "oklch(0.65 0.12 85 / 0.8)" }}
                >
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface)]">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {finalists.map((row) => {
              const cum = row.finalCumulative!;
              const ranks = row.finalRanks;
              const shots = row.finalShotsByStage;
              const eliminated = cum.length < stageCount;

              return (
                <tr
                  key={`${row.lastName}-${row.firstName}`}
                  className="hover:bg-[var(--surface)] transition-colors"
                  style={{ opacity: eliminated ? 0.72 : 1 }}
                >
                  {/* Rank + SO badge */}
                  <td className="w-8 px-2 py-2 text-center align-top">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-base leading-none" style={{ color: rankColor(row.finalRank) }}>
                        {row.finalRank}
                      </span>
                      {row.finalShootOff && (
                        <span className="text-[0.55rem] font-bold text-amber-600 leading-none">SO</span>
                      )}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="min-w-[150px] px-3 py-2 align-top">
                    <span className="text-xs font-semibold text-[var(--ink)]">{row.lastName}</span>{" "}
                    <span className="text-xs text-[var(--muted)]">{row.firstName}</span>
                  </td>

                  {/* NOC */}
                  <td className="px-2 py-2 align-top">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">
                      {row.teamNoc}
                    </span>
                  </td>

                  {/* Stage cells */}
                  {Array.from({ length: stageCount }, (_, i) => {
                    const score = cum[i];
                    const rank = ranks?.[i];
                    const stageShots = shots?.[i] ?? [];
                    const isLastForShooter = i === cum.length - 1 && eliminated;

                    return (
                      <td
                        key={i}
                        className="w-16 px-1 py-1.5 text-center align-top"
                        style={isLastForShooter ? { background: "oklch(0.95 0.04 25 / 0.25)" } : undefined}
                      >
                        {score != null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {/* Cumulative score */}
                            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">
                              {fmtScore(score)}
                            </span>
                            {/* Rank chip */}
                            {rank != null && (
                              <span className="text-[0.5rem] font-bold leading-none" style={{ color: rankColor(rank) }}>
                                #{rank}
                              </span>
                            )}
                            {/* Individual shots (toggle) */}
                            {showShots && stageShots.length > 0 && (
                              <div className="mt-1 flex flex-col items-center gap-px border-t border-[var(--border)] pt-1">
                                {stageShots.map((shot, si) => (
                                  <span
                                    key={si}
                                    className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] leading-tight"
                                    style={{ color: shot >= (isAP ? 10 : 10.5) ? "var(--brand-primary)" : "var(--muted)" }}
                                  >
                                    {fmtScore(shot)}
                                  </span>
                                ))}
                                {/* Pad empty rows for alignment across finalists */}
                                {Array.from({ length: maxShotsPerStage[i] - stageShots.length }, (_, pi) => (
                                  <span key={`pad-${pi}`} className="text-[0.6rem] leading-tight text-transparent">0</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--subtle)] text-[0.65rem]">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Final total */}
                  <td className="px-3 py-2 text-right align-top">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm" style={{ color: rankColor(row.finalRank) }}>
                      {isAP ? row.finalTotal : row.finalTotal?.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DISCIPLINES = ["ARM", "ARW", "APM", "APW"] as const;
const DISC_LABEL: Record<string, string> = {
  ARM: "Air Rifle Men",
  ARW: "Air Rifle Women",
  APM: "Air Pistol Men",
  APW: "Air Pistol Women",
};
const COLLAPSE_AT = 10;
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

const stickyBg = "bg-[var(--bg)] group-hover:bg-[var(--surface)]";
const stickyBgHead = "bg-[var(--surface)]";

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
  const [expandedDiscs, setExpandedDiscs] = useState<Set<string>>(new Set());

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
      setExpandedDiscs(new Set());
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

  function toggleDisc(code: string) {
    setExpandedDiscs((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  function reset() {
    setStep("select");
    setSelectedComp(null);
    setRows([]);
    setResult(null);
    setError(null);
    setNocFilter("");
    setExpandedDiscs(new Set());
  }

  const allNocs = Array.from(new Set(rows.map((r) => r.teamNoc))).sort();
  const filteredRows = nocFilter ? rows.filter((r) => r.teamNoc === nocFilter) : rows;
  const activeCount = rows.filter((r) => !r.skip).length;

  const groupedRows = DISCIPLINES
    .map((code) => ({ code, rows: filteredRows.filter((r) => r.disciplineCode === code) }))
    .filter((g) => g.rows.length > 0);

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
          Uvoz rezultata sa issf-sports.org — scrapeuje HTML tabele sa sajta
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
          <div className="rounded-xl border border-[var(--border)] p-6 space-y-4">
            <h2 className="font-semibold text-[var(--ink)]">Odaberi godinu i nivo</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Godina</label>
                <select
                  value={year}
                  onChange={(e) => { setYear(parseInt(e.target.value)); setCompetitionsLoaded(false); setCompetitions([]); setSelectedComp(null); }}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Nivo</label>
                <select
                  value={compLevel}
                  onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                >
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
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
                          style={{ background: isSelected ? "var(--brand-primary-light)" : undefined }}
                        >
                          <div>
                            <p className="font-semibold text-sm text-[var(--ink)]">{c.name}</p>
                            <p className="text-xs text-[var(--muted)] mt-0.5">{c.city}, {c.nationName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{c.dateFrom.split("T")[0]}</p>
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
                <p className="text-xs text-[var(--muted)]">{selectedComp.dateFrom.split("T")[0]} · {selectedComp.city}</p>
              </div>
              <button
                onClick={handleImport}
                disabled={loading}
                className="shrink-0 rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                    Preuzimam rezultate…
                  </span>
                ) : "Uvezi rezultate →"}
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
              <span><span className="font-semibold text-[var(--ink)]">{eventCount}</span> discipline</span>
              <span><span className="font-semibold text-[var(--ink)]">{activeCount}</span> za unos</span>
              <span><span className="font-semibold text-[var(--ink)]">{rows.filter((r) => r.skip).length}</span> preskočeno</span>
              {rows.filter((r) => r.warning).length > 0 && (
                <span style={{ color: "var(--warning)" }}>⚠ {rows.filter((r) => r.warning).length} novih strelaca</span>
              )}
            </div>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">← Nazad</button>
          </div>

          {/* Country filter */}
          {allNocs.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja:</span>
              <button
                onClick={() => setNocFilter("")}
                className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                style={{ background: nocFilter === "" ? "var(--brand-primary)" : "var(--surface)", color: nocFilter === "" ? "white" : "var(--ink)" }}
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
                      style={{ background: nocFilter === noc ? "var(--brand-accent)" : "var(--surface)", color: nocFilter === noc ? "white" : "var(--ink)" }}
                    >
                      {noc} ({count - skipped}/{count})
                    </button>
                    {skipped < count && (
                      <button onClick={() => skipByNoc(noc)} title={`Skip sve ${noc}`} className="text-[0.65rem] text-[var(--subtle)] hover:text-[var(--brand-primary)] transition-colors">
                        skip sve
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Discipline groups */}
          <div className="space-y-4">
            {groupedRows.map(({ code, rows: discRows }) => {
              const isExpanded = expandedDiscs.has(code);
              const displayRows = isExpanded ? discRows : discRows.slice(0, COLLAPSE_AT);
              const hiddenCount = discRows.length - COLLAPSE_AT;
              const isAP = code.startsWith("AP");
              const maxSeries = Math.max(0, ...discRows.map((r) => r.qualSeries?.length ?? 0));
              const seriesCount = maxSeries > 0 ? maxSeries : 0;

              return (
                <div key={code} className="rounded-xl border border-[var(--border)] overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-base uppercase tracking-wider text-[var(--ink)]">
                        {code}
                      </span>
                      <span className="text-sm text-[var(--muted)]">
                        {DISC_LABEL[code]} · {discRows.filter(r => !r.skip).length}/{discRows.length} strelaca
                      </span>
                    </div>
                    {discRows.length > COLLAPSE_AT && (
                      <button
                        onClick={() => toggleDisc(code)}
                        className="text-xs font-semibold text-[var(--brand-primary)] hover:underline transition-colors"
                      >
                        {isExpanded ? "Skupi ↑" : `Prikaži sve ${discRows.length} ↓`}
                      </button>
                    )}
                  </div>

                  {/* Scrollable table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: seriesCount > 0 ? `${480 + seriesCount * 64}px` : "560px" }}>
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className={`sticky left-0 z-10 w-9 px-2 py-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                            Skip
                          </th>
                          <th className={`sticky left-9 z-10 w-10 px-2 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                            #
                          </th>
                          <th className={`sticky left-[76px] z-10 min-w-[160px] px-3 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                            Strelac
                          </th>
                          <th className={`px-3 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                            NOC
                          </th>
                          {seriesCount > 0 && Array.from({ length: seriesCount }, (_, i) => (
                            <th key={i} className={`px-2 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                              S{i + 1}
                            </th>
                          ))}
                          <th className={`px-3 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                            Total
                          </th>
                          {isAP && (
                            <th className={`px-3 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                              Inners
                            </th>
                          )}
                          <th className={`px-2 py-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                            Q
                          </th>
                          <th className={`px-3 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${stickyBgHead}`}>
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {displayRows.map((row) => {
                          const trueIdx = rows.indexOf(row);
                          return (
                            <tr
                              key={trueIdx}
                              className={`group transition-colors ${row.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}`}
                            >
                              <td className={`sticky left-0 z-10 w-9 px-2 py-2 text-center ${stickyBg} transition-colors`}>
                                <input
                                  type="checkbox"
                                  checked={!!row.skip}
                                  onChange={(e) => updateRow(trueIdx, { skip: e.target.checked })}
                                  className="accent-[var(--brand-primary)]"
                                />
                              </td>
                              <td className={`sticky left-9 z-10 w-10 px-2 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] ${stickyBg} transition-colors`}>
                                {row.qualRank != null ? row.qualRank : "—"}
                              </td>
                              <td className={`sticky left-[76px] z-10 min-w-[160px] px-3 py-2 ${stickyBg} transition-colors`}>
                                <div className="flex gap-1">
                                  <input
                                    value={row.lastName}
                                    onChange={(e) => updateRow(trueIdx, { lastName: e.target.value })}
                                    className="w-[90px] bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-xs font-semibold py-0.5"
                                  />
                                  <input
                                    value={row.firstName}
                                    onChange={(e) => updateRow(trueIdx, { firstName: e.target.value })}
                                    className="w-[70px] bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-xs py-0.5"
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">
                                  {row.teamNoc}
                                </span>
                              </td>
                              {seriesCount > 0 && Array.from({ length: seriesCount }, (_, i) => (
                                <td key={i} className="px-2 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                                  {row.qualSeries?.[i] != null
                                    ? isAP
                                      ? row.qualSeries[i]
                                      : row.qualSeries[i].toFixed(1)
                                    : "—"}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  value={row.qualTotal}
                                  onChange={(e) => updateRow(trueIdx, { qualTotal: parseFloat(e.target.value) })}
                                  step={isAP ? "1" : "0.1"}
                                  className="w-16 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] text-sm py-0.5"
                                />
                              </td>
                              {isAP && (
                                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                                  {row.qualInners != null ? `${row.qualInners}x` : "—"}
                                </td>
                              )}
                              <td className="px-2 py-2 text-center">
                                {row.qualified ? (
                                  <span className="text-[0.65rem] font-bold text-[var(--brand-primary)]">Q</span>
                                ) : (
                                  <span className="text-[0.65rem] text-[var(--subtle)]">—</span>
                                )}
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

                  {/* Expand footer */}
                  {!isExpanded && hiddenCount > 0 && (
                    <button
                      onClick={() => toggleDisc(code)}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[var(--surface)] transition-colors border-t border-[var(--border)] text-center"
                    >
                      Prikaži još {hiddenCount} strelaca ↓
                    </button>
                  )}
                  {isExpanded && discRows.length > COLLAPSE_AT && (
                    <button
                      onClick={() => toggleDisc(code)}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] transition-colors border-t border-[var(--border)] text-center"
                    >
                      Skupi ↑
                    </button>
                  )}

                  {/* Finals sub-section */}
                  <FinalSection discRows={discRows} isAP={isAP} />
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-2">
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
            <div className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-6xl mb-2" style={{ color: "var(--success)" }}>
              {result.inserted}
            </div>
            <p className="text-sm text-[var(--muted)]">
              rezultata uneto{result.skipped > 0 ? ` · ${result.skipped} preskočeno` : ""}
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
