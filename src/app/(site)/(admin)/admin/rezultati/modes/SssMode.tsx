"use client";

import { useState } from "react";
import type { ReviewRow, CommitPayload } from "@/lib/pdf-import/types";
import { CompetitionSearchSelect } from "@/components/ui/CompetitionSearchSelect";
import { SSS_TAG_STYLE, type SssCompetitionTag } from "@/lib/sss/competition-tags";
import { ReviewTable } from "../_shared/ReviewTable";
import { NewShootersPanel } from "../_shared/NewShootersPanel";
import { DonePanel } from "../_shared/DonePanel";

type Step = "select" | "review" | "done";

interface SssBilten { url: string; filename: string; year: number; is10m: boolean; tags: SssCompetitionTag[]; isExternal: boolean }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

export function SssMode() {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bilteni, setBilteni] = useState<SssBilten[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filterExternal, setFilterExternal] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBilten, setSelectedBilten] = useState<SssBilten | null>(null);

  const [selectedCompId, setSelectedCompId] = useState<number | null>(null);
  const [selectedCompName, setSelectedCompName] = useState("");

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
    setSelectedCompId(null);
    setSelectedCompName("");
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
    if (!selectedCompId) { setError("Izaberi takmičenje iz baze"); return; }
    setLoading(true); setError(null);
    const payload: CommitPayload = {
      competitionId: selectedCompId,
      tags: ["sss", ...(selectedBilten?.tags ?? [])],
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
    setSelectedCompId(null); setSelectedCompName("");
  }

  const visible = bilteni.filter((b) => {
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
                          {b.tags.map((tag) => (
                            <span key={tag} className="text-[0.6rem] px-1.5 py-0.5 rounded" style={SSS_TAG_STYLE[tag]}>{tag}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {selectedBilten && (
                <div className="rounded-xl border border-[var(--brand-primary)] p-5 space-y-4">
                  <p className="font-semibold text-sm text-[var(--ink)]">{selectedBilten.filename}</p>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Takmičenje (iz baze)</label>
                    <CompetitionSearchSelect
                      value={selectedCompId}
                      onChange={(competition) => { setSelectedCompId(competition.id); setSelectedCompName(competition.nameSr || competition.name); }}
                    />
                    <p className="text-xs text-[var(--muted)] mt-1.5">
                      Rezultati iz biltena vezuju se za izabrano takmičenje. Ako ga nema,
                      prvo ga kreiraj u <a href="/admin/takmicenja" className="text-[var(--brand-primary)] hover:underline">Takmičenja</a>.
                    </p>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={loading || !selectedCompId}
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

          {selectedCompName && (
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 text-sm">
              <span className="text-[var(--muted)]">Takmičenje: </span>
              <span className="font-semibold text-[var(--ink)]">{selectedCompName}</span>
            </div>
          )}

          <NewShootersPanel rows={rows} onRowChange={updateRow} />

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
