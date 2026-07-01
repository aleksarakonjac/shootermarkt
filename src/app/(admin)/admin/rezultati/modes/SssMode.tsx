"use client";

import { useState } from "react";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";
import { ReviewTable } from "../_shared/ReviewTable";
import { DonePanel } from "../_shared/DonePanel";

type Step = "select" | "review" | "done";

interface SssBilten { url: string; filename: string; year: number; is10m: boolean; isExternal: boolean }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "national",    label: "Državno"           },
  { value: "regional",    label: "Regionalno"        },
  { value: "continental", label: "Kontinentalno"     },
  { value: "world",       label: "Svetsko"           },
  { value: "club",        label: "Klubsko"           },
  { value: "olympic",     label: "Olimpijsko"        },
];

export function SssMode() {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bilteni, setBilteni] = useState<SssBilten[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter10m, setFilter10m] = useState(true);
  const [filterExternal, setFilterExternal] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBilten, setSelectedBilten] = useState<SssBilten | null>(null);

  const [compName, setCompName] = useState("");
  const [compDate, setCompDate] = useState("");
  const [compLocation, setCompLocation] = useState("");
  const [compLevel, setCompLevel] = useState<CompetitionLevel>("national");

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  async function loadBilteni() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/sss/bilteni");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setBilteni(data); setLoaded(true);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  function handleSelect(b: SssBilten) {
    setSelectedBilten(b);
    setCompName(b.filename);
    setCompDate(""); setCompLocation(""); setCompLevel("national");
  }

  async function handleImport() {
    if (!selectedBilten) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/sss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selectedBilten.url, filename: selectedBilten.filename }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setRows(data.rows); setEventCount(data.eventCount); setStep("review");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    setLoading(true); setError(null);
    const payload: CommitPayload = {
      competition: {
        name: compName || selectedBilten?.filename || "SSS bilten",
        date: compDate || new Date().toISOString().split("T")[0],
        location: compLocation,
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
    setStep("select"); setSelectedBilten(null); setRows([]);
    setResult(null); setError(null); setNocFilter("");
  }

  const visible = bilteni.filter((b) => {
    if (filter10m && !b.is10m) return false;
    if (!filterExternal && b.isExternal) return false;
    if (search && !b.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byYear = visible.reduce<Record<number, SssBilten[]>>((acc, b) => {
    (acc[b.year] ??= []).push(b); return acc;
  }, {});

  const activeCount = rows.filter((r) => !r.skip).length;

  if (step === "done" && result) {
    return <DonePanel result={result} onReset={reset} resetLabel="Uvezi još jedan bilten" />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === "select" && (
        <>
          {!loaded ? (
            <div className="rounded-xl border border-[var(--border)] p-8 text-center space-y-3">
              <p className="text-sm text-[var(--muted)]">Bilteni sa serbianshooting.rs/rezultati.htm</p>
              <button
                onClick={loadBilteni}
                disabled={loading}
                className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Učitavam…" : "Učitaj SSS biltene"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži po nazivu…"
                  className="flex-1 min-w-[200px] rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
                <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer select-none">
                  <input type="checkbox" checked={filter10m} onChange={(e) => setFilter10m(e.target.checked)} className="accent-[var(--brand-primary)]" />
                  Samo 10m
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer select-none">
                  <input type="checkbox" checked={filterExternal} onChange={(e) => setFilterExternal(e.target.checked)} className="accent-[var(--brand-primary)]" />
                  Uključi externe
                </label>
                <span className="text-xs text-[var(--subtle)]">{visible.length} biltena</span>
              </div>

              <div className="rounded-xl border border-[var(--border)] overflow-hidden max-h-[420px] overflow-y-auto">
                {Object.entries(byYear).sort(([a], [b]) => parseInt(b) - parseInt(a)).map(([yr, items]) => (
                  <div key={yr}>
                    <div className="sticky top-0 bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">{yr}</div>
                    {items.map((b) => (
                      <button
                        key={b.url}
                        onClick={() => handleSelect(b)}
                        className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors hover:bg-[var(--surface)] border-b border-[var(--border)] last:border-0"
                        style={{ background: selectedBilten?.url === b.url ? "var(--brand-primary-light)" : undefined }}
                      >
                        <span className="text-sm text-[var(--ink)] truncate">{b.filename}</span>
                        <div className="flex gap-1.5 shrink-0">
                          {b.isExternal && (
                            <span className="text-[0.6rem] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--subtle)]">ext</span>
                          )}
                          {b.is10m && (
                            <span className="text-[0.6rem] px-1.5 py-0.5 rounded" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>10m</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {selectedBilten && (
                <div className="rounded-xl border border-[var(--brand-primary)] p-5 space-y-4">
                  <p className="font-semibold text-sm text-[var(--ink)]">{selectedBilten.filename}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Naziv takmičenja</label>
                      <input value={compName} onChange={(e) => setCompName(e.target.value)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Datum</label>
                      <input type="date" value={compDate} onChange={(e) => setCompDate(e.target.value)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Nivo</label>
                      <select value={compLevel} onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]">
                        {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Lokacija</label>
                      <input value={compLocation} onChange={(e) => setCompLocation(e.target.value)} placeholder="npr. Beograd, SC Crvena zvezda" className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]" />
                    </div>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={loading}
                    className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    {loading ? "Preuzimam i parsiram…" : "Uvezi bilten →"}
                  </button>
                </div>
              )}
            </>
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
