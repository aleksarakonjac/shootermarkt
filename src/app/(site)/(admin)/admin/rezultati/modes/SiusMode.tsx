"use client";

import { useState } from "react";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";
import { ReviewTable } from "../_shared/ReviewTable";
import { DonePanel } from "../_shared/DonePanel";

type Step = "select" | "review" | "done";

interface SiusChamp { guid: string; name: string; events: string[] }
interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

const DISC_LABELS: Record<string, string> = {
  ARM: "10m VP Muškarci", ARW: "10m VP Žene",
  APM: "10m AP Muškarci", APW: "10m AP Žene",
};

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "world",       label: "Svetsko (ISSF)"    },
  { value: "continental", label: "Kontinentalno"     },
  { value: "national",    label: "Državno"           },
  { value: "regional",    label: "Regionalno"        },
  { value: "club",        label: "Klubsko"           },
  { value: "olympic",     label: "Olimpijsko"        },
];

export function SiusMode() {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [champs, setChamps] = useState<SiusChamp[]>([]);
  const [champsLoaded, setChampsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SiusChamp | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [compLevel, setCompLevel] = useState<CompetitionLevel>("world");
  const [compDate, setCompDate] = useState("");
  const [compLocation, setCompLocation] = useState("");

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  async function loadChamps() {
    setLoading(true); setError(null); setChampsLoaded(false);
    try {
      const res = await fetch("/api/admin/sius/championships");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setChamps(data); setChampsLoaded(true);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  function selectChamp(c: SiusChamp) {
    setSelected(c);
    setSelectedEvents(new Set(c.events));
    setCompDate(""); setCompLocation("");
  }

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      next.has(ev) ? next.delete(ev) : next.add(ev);
      return next;
    });
  }

  async function handleImport() {
    if (!selected || selectedEvents.size === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/sius/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guid: selected.guid, events: Array.from(selectedEvents), name: selected.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setRows(data.rows); setEventCount(data.eventCount);
      setImportErrors(data.errors ?? []); setStep("review");
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    if (!selected) return;
    setLoading(true); setError(null);
    const payload: CommitPayload = {
      competition: {
        name: selected.name,
        date: compDate || new Date().toISOString().split("T")[0],
        location: compLocation || "",
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
    setStep("select"); setSelected(null); setSelectedEvents(new Set());
    setRows([]); setResult(null); setError(null); setNocFilter(""); setImportErrors([]);
  }

  const filtered = search
    ? champs.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : champs;

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
          {!champsLoaded ? (
            <div className="rounded-xl border border-[var(--border)] p-8 text-center space-y-3">
              <p className="text-sm text-[var(--muted)]">Učitaj listu takmičenja sa results.sius.com (~200 takmičenja)</p>
              <button
                onClick={loadChamps}
                disabled={loading}
                className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Učitavam…" : "Učitaj SIUS takmičenja"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži (ISSF, European, Grand Prix…)"
                  className="flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
                <span className="text-xs text-[var(--subtle)] shrink-0">{filtered.length}/{champs.length}</span>
              </div>

              <div className="rounded-xl border border-[var(--border)] overflow-hidden max-h-[380px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[var(--muted)]">Nema rezultata za &ldquo;{search}&rdquo;</div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {filtered.map((c) => (
                      <button
                        key={c.guid}
                        onClick={() => selectChamp(c)}
                        className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors hover:bg-[var(--surface)]"
                        style={{ background: selected?.guid === c.guid ? "var(--brand-primary-light)" : undefined }}
                      >
                        <span className="font-semibold text-sm text-[var(--ink)] truncate">{c.name}</span>
                        <div className="flex gap-1 shrink-0">
                          {c.events.map((ev) => (
                            <span key={ev} className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] px-1.5 py-0.5 rounded font-semibold border border-[var(--border)]" style={{ color: "var(--brand-primary)" }}>
                              {ev}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selected && (
                <div className="rounded-xl border border-[var(--brand-primary)] p-5 space-y-4">
                  <p className="font-semibold text-[var(--ink)]">{selected.name}</p>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] mb-2">Discipline za uvoz</label>
                    <div className="flex flex-wrap gap-2">
                      {selected.events.map((ev) => (
                        <button
                          key={ev}
                          onClick={() => toggleEvent(ev)}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors border border-[var(--border)]"
                          style={{
                            background: selectedEvents.has(ev) ? "var(--brand-primary)" : "var(--surface)",
                            color: selectedEvents.has(ev) ? "white" : "var(--ink)",
                          }}
                        >
                          {ev}{DISC_LABELS[ev] ? ` — ${DISC_LABELS[ev]}` : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Datum</label>
                      <DatePicker value={compDate} onChange={setCompDate} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Lokacija</label>
                      <input value={compLocation} onChange={(e) => setCompLocation(e.target.value)} placeholder="npr. Ruse, Bugarska" className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Nivo</label>
                      <select value={compLevel} onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]">
                        {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={loading || selectedEvents.size === 0}
                    className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    {loading
                      ? `Preuzimam PDF-ove… (${selectedEvents.size})`
                      : `Uvezi ${selectedEvents.size} disciplin${selectedEvents.size === 1 ? "u" : "e"} →`}
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

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Upozorenja tokom parsiranja:</p>
              {importErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {/* Metadata editable in review */}
          <div className="rounded-xl border border-[var(--border)] p-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Datum takmičenja</label>
              <DatePicker value={compDate} onChange={setCompDate} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Lokacija</label>
              <input value={compLocation} onChange={(e) => setCompLocation(e.target.value)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Nivo</label>
              <select value={compLevel} onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)} className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]">
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
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
