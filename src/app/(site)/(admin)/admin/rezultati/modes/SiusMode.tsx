"use client";

import { useState, useEffect, useRef } from "react";
import type { ReviewRow, CommitPayload } from "@/lib/pdf-import/types";
import type { SiusFinalEntry } from "@/app/api/admin/sius/public-import/route";
import { ReviewTable } from "../_shared/ReviewTable";
import { DonePanel } from "../_shared/DonePanel";
import { MixedTeamReviewTable, type MixedTeamEntry } from "../_shared/MixedTeamReviewTable";

type Step = "pick" | "disciplines" | "review" | "done";

interface DbComp { id: number; name: string; date: string; location: string | null; siusId?: string | null }
interface SiusEvent { runningId: string; eventCode: string; name: string; state: string }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

const SUPPORTED_CODES = new Set(["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW", "ARMT", "APMT"]);

const fmtVal = (v: number, code: string) =>
  (code.startsWith("AR") || code.startsWith("R3P") || code.startsWith("AP")) ? v.toFixed(1) : String(Math.round(v));

// ── CompSearch ────────────────────────────────────────────────────────────────

function CompSearch({ comps, value, onChange }: {
  comps: DbComp[];
  value: number | null;
  onChange: (comp: DbComp | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = comps.find((c) => c.id === value) ?? null;

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const sorted = [...comps].sort((a, b) => b.date.localeCompare(a.date));

  const filtered = query.trim()
    ? sorted.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.date.includes(query) ||
        c.location?.toLowerCase().includes(query.toLowerCase())
      )
    : sorted;

  // pinned: ongoing first, then most recent — max 3
  const pinned = query.trim() ? [] : (() => {
    const ongoing = sorted.filter((c) => c.date <= today);
    return ongoing.slice(0, 3);
  })();
  const pinnedIds = new Set(pinned.map((c) => c.id));
  const listItems = query.trim() ? filtered : filtered.filter((c) => !pinnedIds.has(c.id));

  function pick(c: DbComp) {
    onChange(c);
    setQuery("");
    setOpen(false);
  }

  function renderRow(c: DbComp, label?: string) {
    return (
      <button
        key={c.id}
        onClick={() => pick(c)}
        className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--surface)] transition-colors"
        style={value === c.id ? { background: "var(--brand-primary-light)" } : undefined}
      >
        {label && (
          <span
            className="shrink-0 text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ color: "var(--brand-primary)", border: "1px solid var(--brand-primary)", opacity: 0.85 }}
          >
            {label}
          </span>
        )}
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] shrink-0 w-24">{c.date.slice(0, 10)}</span>
        <span className="text-sm font-medium text-[var(--ink)] truncate">{c.name}</span>
        {c.siusId && <span className="text-xs shrink-0 font-[family-name:var(--font-jetbrains-mono)]" style={{ color: "var(--success)" }}>SIUS ✓</span>}
        {c.location && <span className="text-xs text-[var(--subtle)] shrink-0 ml-auto hidden sm:block">{c.location}</span>}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-sm text-left focus:outline-none focus:border-[var(--brand-primary)] hover:border-[var(--border-strong)] transition-colors"
      >
        {selected ? (
          <>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] shrink-0">{selected.date.slice(0, 10)}</span>
            <span className="font-semibold text-[var(--ink)] truncate">{selected.name}</span>
            {selected.location && <span className="text-xs text-[var(--subtle)] shrink-0 hidden sm:block">· {selected.location}</span>}
          </>
        ) : (
          <span className="text-[var(--subtle)]">Izaberi takmičenje iz baze…</span>
        )}
        <span className="ml-auto text-[var(--subtle)] text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraži po nazivu, datumu, mestu…"
              className="w-full text-sm px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--subtle)]">Nema rezultata.</div>
            )}
            {pinned.length > 0 && (
              <>
                {pinned.map((c, i) => renderRow(c, i === 0 ? "Tekuće" : "Nedavno"))}
                {listItems.length > 0 && (
                  <div className="flex items-center gap-3 px-3 py-1.5">
                    <div className="flex-1 border-t border-[var(--border)]" />
                    <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-[var(--subtle)]">Sva takmičenja</span>
                    <div className="flex-1 border-t border-[var(--border)]" />
                  </div>
                )}
              </>
            )}
            {listItems.map((c) => renderRow(c))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SiusMode() {
  const [step, setStep] = useState<Step>("pick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dbComps, setDbComps] = useState<DbComp[]>([]);
  const [selectedComp, setSelectedComp] = useState<DbComp | null>(null);
  const [siusId, setSiusId] = useState("");

  const [events, setEvents] = useState<SiusEvent[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [finalEntries, setFinalEntries] = useState<SiusFinalEntry[]>([]);
  const [teamEntries, setTeamEntries] = useState<MixedTeamEntry[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((r) => r.json())
      .then((data: DbComp[]) => setDbComps(data))
      .catch(() => {});
  }, []);

  function handleCompPick(comp: DbComp | null) {
    setSelectedComp(comp);
    if (comp?.siusId) setSiusId(comp.siusId);
  }

  async function handleLoadEvents() {
    if (!siusId.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/sius/events?siusId=${encodeURIComponent(siusId.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const supported = (data.events as SiusEvent[]).filter((e) => SUPPORTED_CODES.has(e.eventCode));
      setEvents(supported);
      setSelectedCodes(new Set(supported.map((e) => e.eventCode)));
      setStep("disciplines");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleImport() {
    if (selectedCodes.size === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/sius/public-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siusId: siusId.trim(), disciplineCodes: Array.from(selectedCodes) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setRows(data.rows);
      setFinalEntries(data.finalEntries ?? []);
      setTeamEntries(data.teamEntries ?? []);
      setEventCount(data.eventCount);
      setImportErrors(data.errors ?? []);
      setStep("review");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    if (!selectedComp) return;
    setLoading(true); setError(null);

    // Merge active final entries into qual rows before committing
    const activeFinals = finalEntries.filter((f) => !f.skip);
    const mergedRows = rows.map((r) => {
      const f = activeFinals.find(
        (fe) => fe.disciplineCode === r.disciplineCode && (
          (fe.siusAthleteId && fe.siusAthleteId === r.issfId) ||
          (fe.lastName.toLowerCase() === r.lastName.toLowerCase() &&
           fe.firstName.toLowerCase() === r.firstName.toLowerCase())
        )
      );
      if (!f) return r;
      return {
        ...r,
        qualified: true,
        finalTotal: f.total,
        finalRank: f.rank,
        finalSeries: f.series.length > 0 ? f.series : null,
      };
    });

    const payload: CommitPayload = { competitionId: selectedComp.id, rows: mergedRows };
    let inserted = 0, skipped = 0;
    const errors: string[] = [];
    try {
      if (mergedRows.length > 0) {
        const res = await fetch("/api/admin/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Commit error");
        inserted += data.inserted ?? 0;
        skipped += data.skipped ?? 0;
        errors.push(...(data.errors ?? []));
      }

      // Mixed team entries commit through a separate endpoint, one call per discipline.
      const byDisc = new Map<string, MixedTeamEntry[]>();
      for (const e of teamEntries) {
        if (!byDisc.has(e.disciplineCode)) byDisc.set(e.disciplineCode, []);
        byDisc.get(e.disciplineCode)!.push(e);
      }
      for (const [disc, discEntries] of byDisc) {
        const qualRes = await fetch("/api/admin/import/commit-mixed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitionId: selectedComp.id,
            discipline: disc,
            isFinals: false,
            entries: discEntries.map((e) => ({
              skip: e.skip,
              nocCode: e.nocCode,
              teamNumber: e.teamNumber,
              qualRank: e.qualRank,
              qualTotal: e.qualTotal,
              qualified: e.qualified,
              m_lastName: e.mLastName,
              m_firstName: e.mFirstName,
              m_series: e.m_series,
              mInners: e.mInners,
              mTotal: e.mTotal,
              f_lastName: e.fLastName,
              f_firstName: e.fFirstName,
              f_series: e.f_series,
              fInners: e.fInners,
              fTotal: e.fTotal,
            })),
          }),
        });
        const qualData = await qualRes.json();
        if (!qualRes.ok) { errors.push(qualData.error ?? `${disc}: commit error`); continue; }
        inserted += qualData.inserted ?? 0;
        skipped += qualData.skipped ?? 0;
        errors.push(...(qualData.errors ?? []));

        const finalists = discEntries.filter((e) => !e.skip && e.finalRank != null);
        if (finalists.length > 0) {
          const finalRes = await fetch("/api/admin/import/commit-mixed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              competitionId: selectedComp.id,
              discipline: disc,
              isFinals: true,
              entries: finalists.map((e) => ({
                nocCode: e.nocCode,
                teamNumber: e.teamNumber,
                finalRank: e.finalRank,
                finalTotal: e.finalTotal,
              })),
            }),
          });
          const finalData = await finalRes.json();
          errors.push(...(finalData.errors ?? []));
        }
      }

      setResult({ inserted, skipped, errors, competitionId: selectedComp.id });
      setStep("done");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  function updateRow(idx: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function toggleTeamSkip(idx: number) {
    setTeamEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, skip: !e.skip } : e)));
  }

  function reset() {
    setStep("pick"); setRows([]); setFinalEntries([]); setTeamEntries([]); setResult(null); setError(null);
    setNocFilter(""); setImportErrors([]); setEvents([]);
    setSelectedCodes(new Set()); setSelectedComp(null); setSiusId("");
  }

  function backToPick() {
    setStep("pick"); setEvents([]); setSelectedCodes(new Set()); setError(null);
  }

  const activeCount = rows.filter((r) => !r.skip).length + teamEntries.filter((e) => !e.skip).length;

  if (step === "done" && result) {
    return <DonePanel result={result} onReset={reset} resetLabel="Uvezi još jedno takmičenje" />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Step 1: pick competition + SIUS UUID ── */}
      {step === "pick" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Takmičenje iz baze *</label>
            <CompSearch comps={dbComps} value={selectedComp?.id ?? null} onChange={handleCompPick} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">SIUS UUID</label>
            <input
              value={siusId}
              onChange={(e) => setSiusId(e.target.value)}
              placeholder="npr. f47ac10b-58cc-4372-a567-0e02b2c3d479"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--subtle)]">Polje <code>siusId</code> na stranici takmičenja ili sa shootingsportscloud.com · automatski popunjeno ako takmičenje ima upisano</p>
          </div>

          <button
            onClick={handleLoadEvents}
            disabled={loading || !selectedComp || !siusId.trim()}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Učitavam discipline…" : "Učitaj discipline →"}
          </button>
        </div>
      )}

      {/* ── Step 2: pick disciplines ── */}
      {step === "disciplines" && (
        <div className="space-y-5">
          {/* Selected comp info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--muted)] mb-0.5">Takmičenje</p>
              <p className="font-semibold text-sm text-[var(--ink)] truncate">{selectedComp?.name}</p>
            </div>
            <button onClick={backToPick} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors shrink-0">← Promeni</button>
          </div>

          {events.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Nisu pronađene podržane discipline na ovom SIUS takmičenju.
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-2">Discipline ({events.length} dostupno)</label>
              <div className="flex flex-wrap gap-2">
                {events.map((e) => {
                  const on = selectedCodes.has(e.eventCode);
                  return (
                    <button
                      key={e.eventCode}
                      type="button"
                      onClick={() => setSelectedCodes((prev) => {
                        const next = new Set(prev);
                        if (next.has(e.eventCode)) next.delete(e.eventCode); else next.add(e.eventCode);
                        return next;
                      })}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors border"
                      style={{
                        background: on ? "var(--brand-primary)" : "var(--surface)",
                        color: on ? "white" : "var(--ink)",
                        borderColor: on ? "var(--brand-primary)" : "var(--border)",
                      }}
                    >
                      <span className="font-[family-name:var(--font-jetbrains-mono)]">{e.eventCode}</span>
                      {e.name && <span className="ml-1.5 font-normal opacity-80">— {e.name}</span>}
                      {e.state && e.state !== "Finished" && (
                        <span className="ml-1.5 opacity-60 text-[0.65rem]">({e.state})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={loading || selectedCodes.size === 0}
              className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Preuzimam rezultate…" : `Uvezi ${selectedCodes.size} disciplin${selectedCodes.size === 1 ? "u" : "e"} →`}
            </button>
            <button onClick={backToPick} className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">← Nazad</button>
          </div>
        </div>
      )}

      {/* ── Step 3: review ── */}
      {step === "review" && (
        <>
          {/* Comp + stats header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--muted)]">{selectedComp?.name}</p>
              <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)] mt-1">
                <span><span className="font-semibold text-[var(--ink)]">{eventCount}</span> disciplin{eventCount === 1 ? "a" : "e"}</span>
                <span><span className="font-semibold text-[var(--ink)]">{activeCount}</span> za unos</span>
                <span><span className="font-semibold text-[var(--ink)]">{rows.filter(r => r.skip).length}</span> preskočeno</span>
                {rows.filter(r => r.warning).length > 0 && (
                  <span style={{ color: "var(--warning)" }}>⚠ {rows.filter(r => r.warning).length} novih strelaca</span>
                )}
              </div>
            </div>
            <button onClick={() => setStep("disciplines")} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">← Nazad</button>
          </div>

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Upozorenja:</p>
              {importErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {rows.length > 0 && (
            <ReviewTable rows={rows} nocFilter={nocFilter} onRowChange={updateRow} onNocFilterChange={setNocFilter} onSkipNoc={(noc) => setRows(prev => prev.map(r => r.teamNoc === noc ? { ...r, skip: true } : r))} />
          )}

          {teamEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--muted)]">Mešoviti timovi</p>
              <MixedTeamReviewTable entries={teamEntries} onToggleSkip={toggleTeamSkip} />
            </div>
          )}

          {/* Finals section — per discipline */}
          {finalEntries.length > 0 && (() => {
            const byDisc = Array.from(
              finalEntries.reduce((map, f, idx) => {
                const key = f.disciplineCode;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push({ f, idx });
                return map;
              }, new Map<string, { f: SiusFinalEntry; idx: number }[]>())
            );
            return (
              <div className="space-y-4">
                {byDisc.map(([disc, entries]) => {
                  const maxSeries = Math.max(...entries.map(({ f }) => f.series.length));
                  const activeCount = entries.filter(({ f }) => !f.skip).length;
                  return (
                    <div key={disc} className="rounded-xl border border-[var(--border)] overflow-hidden">
                      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--ink)]">
                          Finale · <span className="font-[family-name:var(--font-jetbrains-mono)]">{disc}</span>
                        </span>
                        <span className="text-xs text-[var(--subtle)]">{activeCount} za unos</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                              <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
                              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
                              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
                              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                              {maxSeries > 0 && Array.from({ length: maxSeries }, (_, i) => (
                                <th key={i} className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">F{i + 1}</th>
                              ))}
                              <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Final ukupno</th>
                              <th className="px-3 py-2.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {[...entries].sort((a, b) => (a.f.rank ?? 99) - (b.f.rank ?? 99)).map(({ f, idx }) => (
                              <tr key={idx} className={f.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}>
                                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold text-[var(--muted)]">{f.rank}</td>
                                <td className="px-3 py-2 font-medium text-[var(--ink)]">{f.lastName}</td>
                                <td className="px-3 py-2 text-[var(--ink)]">{f.firstName}</td>
                                <td className="px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{f.nation}</td>
                                {maxSeries > 0 && Array.from({ length: maxSeries }, (_, i) => (
                                  <td key={i} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">
                                    {f.series[i] != null ? fmtVal(f.series[i], disc) : "—"}
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)]">{fmtVal(f.total, disc)}</td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => setFinalEntries(prev => prev.map((e, i) => i === idx ? { ...e, skip: !e.skip } : e))}
                                    className="text-xs px-2 py-0.5 rounded border transition-colors"
                                    style={f.skip
                                      ? { borderColor: "var(--border)", color: "var(--subtle)" }
                                      : { borderColor: "var(--border-strong)", color: "var(--ink)" }
                                    }
                                  >
                                    {f.skip ? "uključi" : "preskoči"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex gap-3">
            <button onClick={handleCommit} disabled={loading || activeCount === 0} className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
              {loading ? "Unosim…" : `Potvrdi i unesi ${activeCount} rezultata →`}
            </button>
            <button onClick={reset} className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">Otkaži</button>
          </div>
        </>
      )}
    </div>
  );
}
