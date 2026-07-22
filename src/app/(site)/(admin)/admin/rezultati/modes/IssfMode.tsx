"use client";

import { useState, useEffect, useRef } from "react";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";
import { LevelDropdown } from "@/components/ui/LevelDropdown";
import { ReviewTable } from "../_shared/ReviewTable";
import { DonePanel } from "../_shared/DonePanel";

interface DbComp { id: number; name: string; date: string; location: string | null }

function CompSearch({ comps, value, onChange }: {
  comps: DbComp[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = comps.find((c) => c.id === value) ?? null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query.trim()
    ? comps.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.date.includes(query) ||
        c.location?.toLowerCase().includes(query.toLowerCase())
      )
    : comps;

  function pick(c: DbComp | null) {
    onChange(c?.id ?? null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-[280px]">
      {/* Trigger */}
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
          <span className="text-[var(--subtle)]">— kreiraj novo takmičenje —</span>
        )}
        <span className="ml-auto text-[var(--subtle)] text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
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
          <div className="max-h-64 overflow-y-auto">
            <button
              onClick={() => pick(null)}
              className="w-full text-left px-3 py-2 text-sm text-[var(--subtle)] hover:bg-[var(--surface)] transition-colors border-b border-[var(--border)]"
            >
              — kreiraj novo takmičenje —
            </button>
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-[var(--subtle)]">Nema rezultata.</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => pick(c)}
                className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--surface)] transition-colors"
                style={value === c.id ? { background: "var(--brand-primary-light)" } : undefined}
              >
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] shrink-0 w-24">{c.date.slice(0, 10)}</span>
                <span className="text-sm font-medium text-[var(--ink)] truncate">{c.name}</span>
                {c.location && <span className="text-xs text-[var(--subtle)] shrink-0 ml-auto hidden sm:block">{c.location}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Step = "select" | "review" | "done";

interface ISSFComp { id: number; name: string; dateFrom: string; dateTo: string; city: string; nationCode: string; nationName: string }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }
interface MixedEntry {
  skip: boolean; nocCode: string; disciplineCode: string;
  qualRank: number | null; qualTotal: number | null; inners: number | null;
  qualified: boolean; finalRank: number | null; finalTotal: number | null;
  mIssfId: string | null; mLastName: string; mFirstName: string; m_series: number[]; mTotal: number;
  fIssfId: string | null; fLastName: string; fFirstName: string; f_series: number[]; fTotal: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);


export function IssfMode() {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [comps, setComps] = useState<ISSFComp[]>([]);
  const [compsLoaded, setCompsLoaded] = useState(false);
  const [selected, setSelected] = useState<ISSFComp | null>(null);
  const [compLevel, setCompLevel] = useState<CompetitionLevel>("world");
  const [dbComps, setDbComps] = useState<DbComp[]>([]);
  const [linkedDbCompId, setLinkedDbCompId] = useState<number | null>(null);

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [mixedEntries, setMixedEntries] = useState<MixedEntry[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((r) => r.json())
      .then((data: DbComp[]) => setDbComps(data))
      .catch(() => {});
  }, []);

  async function loadComps() {
    setLoading(true); setError(null); setCompsLoaded(false);
    try {
      const res = await fetch(`/api/admin/issf/competitions?year=${year}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setComps(data); setCompsLoaded(true);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleImport() {
    if (!selected) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/issf/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setRows(data.rows);
      setMixedEntries(data.mixedEntries ?? []);
      setEventCount(data.eventCount);
      setStep("review");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    if (!selected) return;
    setLoading(true); setError(null);
    const payload: CommitPayload = linkedDbCompId
      ? { competitionId: linkedDbCompId, rows }
      : {
          competition: {
            name: selected.name,
            date: selected.dateFrom.split("T")[0],
            location: selected.city,
            level: compLevel,
          },
          rows,
        };
    try {
      // 1. Commit individual results
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Commit error");

      const resolvedCompId: number = data.competitionId;

      // 2. Commit mixed team entries (per discipline)
      const activeMixed = mixedEntries.filter((e) => !e.skip);
      if (activeMixed.length > 0) {
        const byDisc = new Map<string, MixedEntry[]>();
        for (const e of activeMixed) {
          if (!byDisc.has(e.disciplineCode)) byDisc.set(e.disciplineCode, []);
          byDisc.get(e.disciplineCode)!.push(e);
        }
        for (const [disc, discEntries] of byDisc) {
          await fetch("/api/admin/import/commit-mixed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              competitionId: resolvedCompId,
              discipline: disc,
              isFinals: false,
              entries: discEntries.map((e) => ({
                skip: e.skip, nocCode: e.nocCode,
                qualRank: e.qualRank, qualTotal: e.qualTotal, qualified: e.qualified,
                m_lastName: e.mLastName, m_firstName: e.mFirstName, m_series: e.m_series, mTotal: e.mTotal,
                f_lastName: e.fLastName, f_firstName: e.fFirstName, f_series: e.f_series, fTotal: e.fTotal,
              })),
            }),
          });
          const finalists = discEntries.filter((e) => e.finalRank != null);
          if (finalists.length > 0) {
            await fetch("/api/admin/import/commit-mixed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                competitionId: resolvedCompId,
                discipline: disc,
                isFinals: true,
                entries: finalists.map((e) => ({ nocCode: e.nocCode, finalRank: e.finalRank, finalTotal: e.finalTotal })),
              }),
            });
          }
        }
      }

      setResult(data); setStep("done");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  function updateRow(idx: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function reset() {
    setStep("select"); setSelected(null); setRows([]);
    setMixedEntries([]); setResult(null); setError(null);
    setNocFilter(""); setLinkedDbCompId(null);
  }

  const activeCount = rows.filter((r) => !r.skip).length;
  const activeMixedCount = mixedEntries.filter((e) => !e.skip).length;

  if (step === "done" && result) {
    return <DonePanel result={result} onReset={reset} resetLabel="Uvezi još jedno takmičenje" />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === "select" && (
        <>
          <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Odaberi godinu</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Godina</label>
                <div className="flex gap-1 flex-wrap">
                  {YEARS.map((y) => (
                    <button
                      key={y}
                      onClick={() => { setYear(y); setCompsLoaded(false); setComps([]); setSelected(null); }}
                      className="px-3 py-1 rounded text-sm font-bold transition-colors font-[family-name:var(--font-jetbrains-mono)]"
                      style={
                        year === y
                          ? { background: "var(--ink)", color: "var(--bg)" }
                          : { background: "var(--surface-2)", color: "var(--muted)" }
                      }
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={loadComps}
                disabled={loading}
                className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Učitavam…" : "Učitaj takmičenja"}
              </button>
            </div>
          </div>

          {compsLoaded && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              {comps.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--muted)]">Nema Rifle/Pistol takmičenja za {year}.</div>
              ) : (
                <>
                  <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2.5 text-xs font-semibold text-[var(--muted)]">
                    {comps.length} takmičenja · klikni za odabir
                  </div>
                  <div className="divide-y divide-[var(--border)] max-h-[380px] overflow-y-auto">
                    {comps.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(selected?.id === c.id ? null : c)}
                        className="w-full text-left px-4 py-3 flex items-start justify-between gap-4 transition-colors hover:bg-[var(--surface)]"
                        style={{ background: selected?.id === c.id ? "var(--brand-primary-light)" : undefined }}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[var(--ink)] truncate">{c.name}</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">{c.city}, {c.nationName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{c.dateFrom.split("T")[0]}</p>
                          <p className="text-xs text-[var(--subtle)] mt-0.5">{c.nationCode}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {selected && (
            <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary-light)]">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[var(--ink)] truncate">{selected.name}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{selected.dateFrom.split("T")[0]} · {selected.city}</p>
              </div>
              <button
                onClick={handleImport}
                disabled={loading}
                className="shrink-0 rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Preuzimam rezultate…" : "Uvezi rezultate →"}
              </button>
            </div>
          )}
        </>
      )}

      {step === "review" && (
        <>
          {/* Competition selector — top */}
          <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Takmičenje u bazi</span>
              {!linkedDbCompId && (
                <div className="w-48 shrink-0">
                  <LevelDropdown value={compLevel} onChange={(v) => setCompLevel(v as CompetitionLevel)} />
                </div>
              )}
              {linkedDbCompId && (
                <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>✓ Rezultati idu u postojeće takmičenje</span>
              )}
            </div>
            <CompSearch comps={dbComps} value={linkedDbCompId} onChange={setLinkedDbCompId} />
          </div>

          {/* Stats + back */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span><span className="font-semibold text-[var(--ink)]">{eventCount}</span> discipline</span>
              <span><span className="font-semibold text-[var(--ink)]">{activeCount}</span> za unos</span>
              <span><span className="font-semibold text-[var(--ink)]">{rows.filter(r => r.skip).length}</span> preskočeno</span>
              {rows.filter(r => r.warning).length > 0 && (
                <span style={{ color: "var(--warning)" }}>⚠ {rows.filter(r => r.warning).length} novih strelaca</span>
              )}
            </div>
            <button onClick={reset} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">← Nazad</button>
          </div>

          <ReviewTable rows={rows} nocFilter={nocFilter} onRowChange={updateRow} onNocFilterChange={setNocFilter} onSkipNoc={(noc) => setRows(prev => prev.map(r => r.teamNoc === noc ? { ...r, skip: true } : r))} />

          {/* Mixed team review */}
          {mixedEntries.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)]">Mešoviti tim · {activeMixedCount} za unos</span>
                <span className="text-xs text-[var(--subtle)]">{mixedEntries.filter(e => e.skip).length} preskočeno</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {mixedEntries.map((e, idx) => (
                  <div key={idx} className={`px-4 py-3 flex items-center gap-3 ${e.skip ? "opacity-40" : ""}`}>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold text-[var(--muted)] w-12 shrink-0">{e.nocCode}</span>
                    <span className="text-[0.7rem] font-semibold text-[var(--subtle)] w-16 shrink-0">{e.disciplineCode}</span>
                    <div className="flex-1 min-w-0 text-sm text-[var(--ink)]">
                      <span>{e.mLastName} {e.mFirstName}</span>
                      <span className="text-[var(--subtle)] mx-1.5">/</span>
                      <span>{e.fLastName} {e.fFirstName}</span>
                    </div>
                    {e.qualTotal != null && (
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] shrink-0">
                        {e.qualTotal}{e.inners != null ? ` (${e.inners}x)` : ""}
                      </span>
                    )}
                    {e.qualRank != null && (
                      <span className="text-xs text-[var(--subtle)] shrink-0">#{e.qualRank}</span>
                    )}
                    <button
                      onClick={() => setMixedEntries(prev => prev.map((m, i) => i === idx ? { ...m, skip: !m.skip } : m))}
                      className="shrink-0 text-xs px-2 py-0.5 rounded border transition-colors"
                      style={e.skip
                        ? { borderColor: "var(--border)", color: "var(--subtle)" }
                        : { borderColor: "var(--border-strong)", color: "var(--ink)" }
                      }
                    >
                      {e.skip ? "uključi" : "preskoči"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleCommit} disabled={loading || (activeCount === 0 && activeMixedCount === 0)} className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
              {loading ? "Unosim…" : activeMixedCount > 0
                ? `Potvrdi i unesi ${activeCount} + ${activeMixedCount} mešovitih →`
                : `Potvrdi i unesi ${activeCount} rezultata →`}
            </button>
            <button onClick={reset} className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">Otkaži</button>
          </div>
        </>
      )}
    </div>
  );
}
