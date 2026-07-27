"use client";

import { useState, useEffect, useRef } from "react";
import { MIXED_TEAM_CODES, type DisciplineCode, type ReviewRow, type CommitPayload } from "@/lib/pdf-import/types";
import { MixedFinalsTable, MixedQualificationTable, ReviewTable } from "../_shared/ReviewTable";
import { DonePanel } from "../_shared/DonePanel";

type Step = "pick" | "disciplines" | "review" | "done";

interface DbComp { id: number; name: string; date: string; location: string | null; issfId?: string | null }
interface IssfEvent { code: string; label: string }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }
interface MixedEntry {
  skip: boolean; nocCode: string; disciplineCode: DisciplineCode;
  qualRank: number | null; qualTotal: number | null; inners: number | null;
  qualified: boolean; finalRank: number | null; finalTotal: number | null;
  mIssfId: string | null; mLastName: string; mFirstName: string; m_series: number[]; mInners: number | null; mTotal: number;
  fIssfId: string | null; fLastName: string; fFirstName: string; f_series: number[]; fInners: number | null; fTotal: number;
}

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

  const pinned = query.trim() ? [] : sorted.filter((c) => c.date <= today).slice(0, 3);
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
        {c.issfId && <span className="text-xs shrink-0 font-[family-name:var(--font-jetbrains-mono)]" style={{ color: "var(--success)" }}>ISSF ✓</span>}
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

export function IssfMode() {
  const [step, setStep] = useState<Step>("pick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dbComps, setDbComps] = useState<DbComp[]>([]);
  const [selectedComp, setSelectedComp] = useState<DbComp | null>(null);
  const [issfId, setIssfId] = useState("");

  const [events, setEvents] = useState<IssfEvent[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

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

  function handleCompPick(comp: DbComp | null) {
    setSelectedComp(comp);
    if (comp?.issfId) setIssfId(comp.issfId);
  }

  async function handleLoadEvents() {
    if (!issfId.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/issf/events?competitionId=${encodeURIComponent(issfId.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEvents(data);
      setSelectedCodes(new Set((data as IssfEvent[]).map((e) => e.code)));
      setStep("disciplines");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleImport() {
    if (selectedCodes.size === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/issf/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: issfId.trim(), disciplineCodes: Array.from(selectedCodes) }),
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
    if (!selectedComp) return;
    setLoading(true); setError(null);
    const payload: CommitPayload = { competitionId: selectedComp.id, rows };
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
                m_lastName: e.mLastName, m_firstName: e.mFirstName, m_series: e.m_series, mInners: e.mInners, mTotal: e.mTotal,
                f_lastName: e.fLastName, f_firstName: e.fFirstName, f_series: e.f_series, fInners: e.fInners, fTotal: e.fTotal,
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
    setStep("pick"); setRows([]); setMixedEntries([]); setResult(null); setError(null);
    setNocFilter(""); setEvents([]);
    setSelectedCodes(new Set()); setSelectedComp(null); setIssfId("");
  }

  function backToPick() {
    setStep("pick"); setEvents([]); setSelectedCodes(new Set()); setError(null);
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

      {/* ── Step 1: pick competition + ISSF ID ── */}
      {step === "pick" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Takmičenje iz baze *</label>
            <CompSearch comps={dbComps} value={selectedComp?.id ?? null} onChange={handleCompPick} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1">ISSF ID takmičenja</label>
            <input
              value={issfId}
              onChange={(e) => setIssfId(e.target.value)}
              placeholder="npr. 3574"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--subtle)]">ID iz URL-a issf-sports.org/competitions/&lt;id&gt; · automatski popunjeno ako takmičenje ima upisano</p>
          </div>

          <button
            onClick={handleLoadEvents}
            disabled={loading || !selectedComp || !issfId.trim()}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Učitavam discipline…" : "Učitaj discipline →"}
          </button>
        </div>
      )}

      {/* ── Step 2: pick disciplines ── */}
      {step === "disciplines" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--muted)] mb-0.5">Takmičenje</p>
              <p className="font-semibold text-sm text-[var(--ink)] truncate">{selectedComp?.name}</p>
            </div>
            <button onClick={backToPick} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors shrink-0">← Promeni</button>
          </div>

          {events.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Nisu pronađene podržane discipline na ovom ISSF takmičenju.
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-xs font-semibold text-[var(--muted)]">Discipline ({events.length} dostupno)</label>
                <button
                  type="button"
                  onClick={() => setSelectedCodes(new Set(events.filter((e) => MIXED_TEAM_CODES.includes(e.code as typeof MIXED_TEAM_CODES[number])).map((e) => e.code)))}
                  className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                >
                  Samo miks
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {events.map((e) => {
                  const on = selectedCodes.has(e.code);
                  return (
                    <button
                      key={e.code}
                      type="button"
                      onClick={() => setSelectedCodes((prev) => {
                        const next = new Set(prev);
                        if (next.has(e.code)) next.delete(e.code); else next.add(e.code);
                        return next;
                      })}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors border"
                      style={{
                        background: on ? "var(--brand-primary)" : "var(--surface)",
                        color: on ? "white" : "var(--ink)",
                        borderColor: on ? "var(--brand-primary)" : "var(--border)",
                      }}
                    >
                      <span className="font-[family-name:var(--font-jetbrains-mono)]">{e.code}</span>
                      {e.label && <span className="ml-1.5 font-normal opacity-80">— {e.label}</span>}
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

          <ReviewTable rows={rows} nocFilter={nocFilter} onRowChange={updateRow} onNocFilterChange={setNocFilter} onSkipNoc={(noc) => setRows(prev => prev.map(r => r.teamNoc === noc ? { ...r, skip: true } : r))} />

          {mixedEntries.length > 0 && (
            <>
              <MixedQualificationTable
                entries={mixedEntries}
                onSkipChange={(index, skip) => setMixedEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, skip } : entry))}
              />
              <MixedFinalsTable
                entries={mixedEntries}
                onSkipChange={(index, skip) => setMixedEntries((prev) => prev.map((entry, i) => i === index ? { ...entry, skip } : entry))}
              />
            </>
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
