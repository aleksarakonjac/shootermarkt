"use client";

import { useState } from "react";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";
import { LevelDropdown } from "@/components/ui/LevelDropdown";
import { ReviewTable } from "../_shared/ReviewTable";
import { DonePanel } from "../_shared/DonePanel";

type Step = "select" | "review" | "done";

interface ISSFComp { id: number; name: string; dateFrom: string; dateTo: string; city: string; nationCode: string; nationName: string }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

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

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

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
      setRows(data.rows); setEventCount(data.eventCount); setStep("review");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    if (!selected) return;
    setLoading(true); setError(null);
    const payload: CommitPayload = {
      competition: {
        name: selected.name,
        date: selected.dateFrom.split("T")[0],
        location: selected.city,
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
      setResult(data); setStep("done");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  function updateRow(idx: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function reset() {
    setStep("select"); setSelected(null); setRows([]);
    setResult(null); setError(null); setNocFilter("");
  }

  const activeCount = rows.filter((r) => !r.skip).length;

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
            <h3 className="text-sm font-semibold text-[var(--ink)]">Odaberi godinu i nivo</h3>
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
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-56">
                  <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Nivo u bazi</label>
                  <LevelDropdown value={compLevel} onChange={(v) => setCompLevel(v as CompetitionLevel)} />
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
                {loading ? "Preuzimam PDF-ove…" : "Uvezi rezultate →"}
              </button>
            </div>
          )}
        </>
      )}

      {step === "review" && (
        <>
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
