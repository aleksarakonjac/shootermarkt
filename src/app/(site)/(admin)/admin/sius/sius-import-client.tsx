"use client";

import { useState } from "react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/DatePicker";
import { CompetitionPinnedSelect } from "@/components/ui/CompetitionPinnedSelect";
import type { CompetitionOption } from "@/components/ui/CompetitionPinnedSelect";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";

type Step = "select" | "review" | "done";

interface SiusChampionship {
  guid: string;
  name: string;
  events: string[];
}

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId: number;
}

const DISCIPLINES = ["ARM", "ARW", "APM", "APW"] as const;

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "world",         label: "ISSF–Svetsko" },
  { value: "continental",   label: "Kontinentalno (ESC)" },
  { value: "international", label: "Međunarodno" },
  { value: "national",      label: "Državno" },
  { value: "regional",      label: "Regionalno" },
  { value: "club",          label: "Klubsko (liga)" },
  { value: "olympic",       label: "Olimpijsko" },
];

const DISC_LABELS: Record<string, string> = {
  ARM: "10m Vazdušna puška M",
  ARW: "10m Vazdušna puška Ž",
  APM: "10m Vazdušni pištolj M",
  APW: "10m Vazdušni pištolj Ž",
};

export function SiusImportClient() {
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [championships, setChampionships] = useState<SiusChampionship[]>([]);
  const [champsLoaded, setChampsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedComp, setSelectedComp] = useState<SiusChampionship | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [compLevel, setCompLevel] = useState<CompetitionLevel>("world");
  const [compDate, setCompDate] = useState("");
  const [compLocation, setCompLocation] = useState("");

  const [competitionMode, setCompetitionMode] = useState<"new" | "existing">("existing");
  const [selectedDbComp, setSelectedDbComp] = useState<CompetitionOption | null>(null);

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [nocFilter, setNocFilter] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  async function loadChampionships() {
    setLoading(true);
    setError(null);
    setChampsLoaded(false);
    try {
      const res = await fetch("/api/admin/sius/championships");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setChampionships(data);
      setChampsLoaded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function selectComp(c: SiusChampionship) {
    setSelectedComp(c);
    setSelectedEvents(new Set(c.events)); // select all available by default
    setCompDate("");
    setCompLocation("");
  }

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(ev)) { next.delete(ev); } else { next.add(ev); }
      return next;
    });
  }

  async function handleImport() {
    if (!selectedComp || selectedEvents.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sius/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guid: selectedComp.guid,
          events: Array.from(selectedEvents),
          name: selectedComp.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setRows(data.rows);
      setEventCount(data.eventCount);
      setImportErrors(data.errors ?? []);
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
    const useExisting = competitionMode === "existing" && selectedDbComp;
    const payload: CommitPayload = useExisting
      ? { competitionId: selectedDbComp.id, rows }
      : {
          competition: {
            name: selectedComp.name,
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
    setSelectedEvents(new Set());
    setSelectedDbComp(null);
    setRows([]);
    setResult(null);
    setError(null);
    setNocFilter("");
    setImportErrors([]);
  }

  const filtered = championships.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const pinned = !search ? championships.slice(0, 3) : [];
  const listItems = !search ? championships.slice(3) : filtered;

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
          SIUS Import
        </h1>
        <p className="text-sm mt-1 text-[var(--muted)]">
          Uvoz rezultata sa results.sius.com — automatski preuzima PDF-ove i parsira ih
        </p>
      </div>

      <div className="flex items-center gap-2 mb-8 text-xs font-semibold uppercase tracking-wider">
        {(["select", "review", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--subtle)]">→</span>}
            <span style={{ color: step === s ? "var(--brand-primary)" : "var(--subtle)" }}>
              {i + 1}. {s === "select" ? "Odabir" : s === "review" ? "Pregled" : "Gotovo"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Step 1: Select ── */}
      {step === "select" && (
        <div className="space-y-6">
          {!champsLoaded ? (
            <div className="rounded-xl border border-[var(--border)] p-8 text-center space-y-4">
              <p className="text-sm text-[var(--muted)]">
                Učitaj listu takmičenja sa results.sius.com (~200 takmičenja, jednom po sesiji)
              </p>
              <button
                onClick={loadChampionships}
                disabled={loading}
                className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Učitavam..." : "Učitaj SIUS takmičenja"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži po nazivu (npr. ISSF, European, Grand Prix...)"
                  className="flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
                <span className="flex items-center text-xs text-[var(--muted)] shrink-0">
                  {filtered.length}/{championships.length}
                </span>
              </div>

              {/* Pinned: current + 2 recent (hidden during search) */}
              {pinned.length > 0 && (
                <div className="space-y-1.5">
                  {pinned.map((c, i) => {
                    const isSelected = selectedComp?.guid === c.guid;
                    const label = i === 0 ? "Tekuće" : "Nedavno";
                    const labelColor = i === 0 ? "var(--brand-primary)" : "var(--muted)";
                    return (
                      <button
                        key={c.guid}
                        onClick={() => selectComp(c)}
                        className="w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between gap-4 transition-colors hover:bg-[var(--surface)]"
                        style={{
                          borderColor: isSelected ? "var(--brand-primary)" : "var(--border)",
                          background: isSelected ? "var(--brand-primary-light)" : "var(--bg)",
                        }}
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <span
                            className="shrink-0 text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                            style={{ color: labelColor, border: `1px solid ${labelColor}`, opacity: 0.8 }}
                          >
                            {label}
                          </span>
                          <p className="font-semibold text-sm text-[var(--ink)] truncate">{c.name}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {c.events.map((ev) => (
                            <span
                              key={ev}
                              className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: "var(--surface)", color: "var(--brand-primary)", border: "1px solid var(--border)" }}
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-3 pt-1 pb-0.5">
                    <div className="flex-1 border-t border-[var(--border)]" />
                    <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--subtle)]">Sva takmičenja</span>
                    <div className="flex-1 border-t border-[var(--border)]" />
                  </div>
                </div>
              )}

              {/* Championship list */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden max-h-[360px] overflow-y-auto">
                {listItems.length === 0 && search ? (
                  <div className="py-10 text-center text-sm text-[var(--muted)]">
                    Nema rezultata za &ldquo;{search}&rdquo;
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {listItems.map((c) => {
                      const isSelected = selectedComp?.guid === c.guid;
                      return (
                        <button
                          key={c.guid}
                          onClick={() => selectComp(c)}
                          className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors hover:bg-[var(--surface)]"
                          style={{ background: isSelected ? "var(--brand-primary-light)" : undefined }}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-[var(--ink)] truncate">{c.name}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {c.events.map((ev) => (
                              <span
                                key={ev}
                                className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] px-1.5 py-0.5 rounded font-semibold"
                                style={{ background: "var(--surface)", color: "var(--brand-primary)", border: "1px solid var(--border)" }}
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected championship controls */}
              {selectedComp && (
                <div className="rounded-xl border border-[var(--brand-primary)] p-5 space-y-4">
                  <p className="font-semibold text-[var(--ink)]">{selectedComp.name}</p>

                  {/* Competition link */}
                  <div>
                    <div className="flex gap-1 mb-2 p-0.5 rounded-md bg-[var(--surface)] w-fit">
                      {(["existing", "new"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setCompetitionMode(mode)}
                          className="rounded px-3 py-1 text-xs font-semibold transition-colors"
                          style={{
                            background: competitionMode === mode ? "var(--bg)" : "transparent",
                            color: competitionMode === mode ? "var(--ink)" : "var(--muted)",
                            boxShadow: competitionMode === mode ? "0 1px 3px oklch(0 0 0/0.08)" : "none",
                          }}
                        >
                          {mode === "existing" ? "Poveži sa postojećim" : "Novo takmičenje"}
                        </button>
                      ))}
                    </div>
                    {competitionMode === "existing" ? (
                      <CompetitionPinnedSelect
                        value={selectedDbComp?.id ?? null}
                        onChange={setSelectedDbComp}
                      />
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum</label>
                          <DatePicker value={compDate} onChange={setCompDate} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Lokacija</label>
                          <input
                            value={compLocation}
                            onChange={(e) => setCompLocation(e.target.value)}
                            placeholder="npr. Ruse, Bugarska"
                            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Nivo</label>
                          <select
                            value={compLevel}
                            onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)}
                            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                          >
                            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Discipline selection */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                      Discipline za uvoz
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedComp.events.map((ev) => (
                        <button
                          key={ev}
                          onClick={() => toggleEvent(ev)}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                          style={{
                            background: selectedEvents.has(ev) ? "var(--brand-primary)" : "var(--surface)",
                            color: selectedEvents.has(ev) ? "white" : "var(--ink)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {ev} — {DISC_LABELS[ev]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={loading || selectedEvents.size === 0}
                    className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    {loading
                      ? `Preuzimam PDF-ove... (${selectedEvents.size} disciplin${selectedEvents.size === 1 ? "a" : "e"})`
                      : `Uvezi ${selectedEvents.size} disciplin${selectedEvents.size === 1 ? "u" : "e"} →`}
                  </button>
                </div>
              )}
            </>
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

          {importErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Upozorenja tokom parsiranja:</p>
              {importErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {/* Metadata for commit */}
          <div className="rounded-xl border border-[var(--border)] p-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum takmičenja</label>
              <input
                type="date"
                value={compDate}
                onChange={(e) => setCompDate(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Lokacija</label>
              <input
                value={compLocation}
                onChange={(e) => setCompLocation(e.target.value)}
                placeholder="npr. Ruse, Bugarska"
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Nivo</label>
              <select
                value={compLevel}
                onChange={(e) => setCompLevel(e.target.value as CompetitionLevel)}
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
              >
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
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
                      <button
                        onClick={() => skipByNoc(noc)}
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
                    <tr key={visIdx} className={`transition-colors ${row.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}`}>
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
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">{row.teamNoc}</span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.disciplineCode}
                          onChange={(e) => updateRow(trueIdx, { disciplineCode: e.target.value as ReviewRow["disciplineCode"] })}
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
                          value={row.qualTotal ?? ""}
                          onChange={(e) => updateRow(trueIdx, { qualTotal: parseFloat(e.target.value) })}
                          step="0.1"
                          className="w-16 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] text-sm py-0.5"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">
                        {row.qualInners != null ? `${row.qualInners}x` : "—"}
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
