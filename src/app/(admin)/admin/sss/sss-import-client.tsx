"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import type { ReviewRow, CommitPayload, CompetitionLevel } from "@/lib/pdf-import/types";

type Step = "select" | "review" | "done";

interface SssBilten {
  url: string;
  filename: string;
  year: number;
  is10m: boolean;
  isExternal: boolean;
}

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

const DISCIPLINES = ["ARM", "ARW", "APM", "APW"] as const;

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "national",      label: "Državno" },
  { value: "regional",      label: "Regionalno" },
  { value: "international", label: "Međunarodno" },
  { value: "continental",   label: "Kontinentalno (ESC)" },
  { value: "world",         label: "ISSF–Svetsko" },
  { value: "club",          label: "Klubsko (liga)" },
  { value: "olympic",       label: "Olimpijsko" },
];

export function SssImportClient() {
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sss/bilteni");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setBilteni(data);
      setLoaded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(b: SssBilten) {
    setSelectedBilten(b);
    setCompName(b.filename);
    setCompDate("");
    setCompLocation("");
    setCompLevel("national");
  }

  async function handleImport() {
    if (!selectedBilten) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selectedBilten.url, filename: selectedBilten.filename }),
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
    setLoading(true);
    setError(null);
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
    setSelectedBilten(null);
    setRows([]);
    setResult(null);
    setError(null);
    setNocFilter("");
  }

  const visible = bilteni.filter((b) => {
    if (filter10m && !b.is10m) return false;
    if (!filterExternal && b.isExternal) return false;
    if (search && !b.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byYear = visible.reduce<Record<number, SssBilten[]>>((acc, b) => {
    (acc[b.year] ??= []).push(b);
    return acc;
  }, {});

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
          SSS Import
        </h1>
        <p className="text-sm mt-1 text-[var(--muted)]">
          Uvoz biltena sa serbianshooting.rs/rezultati.htm
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

      {/* ── Step 1 ── */}
      {step === "select" && (
        <div className="space-y-5">
          {!loaded ? (
            <div className="rounded-xl border border-[var(--border)] p-8 text-center space-y-4">
              <p className="text-sm text-[var(--muted)]">Učitaj biltene sa serbianshooting.rs/rezultati.htm</p>
              <button
                onClick={loadBilteni}
                disabled={loading}
                className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? "Učitavam..." : "Učitaj SSS biltene"}
              </button>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži po nazivu..."
                  className="flex-1 min-w-[200px] rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                />
                <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter10m}
                    onChange={(e) => setFilter10m(e.target.checked)}
                    className="accent-[var(--brand-primary)]"
                  />
                  Samo 10m
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterExternal}
                    onChange={(e) => setFilterExternal(e.target.checked)}
                    className="accent-[var(--brand-primary)]"
                  />
                  Uključi eksterne (ISSF, ESC...)
                </label>
                <span className="text-xs text-[var(--subtle)]">{visible.length} biltena</span>
              </div>

              {/* Grouped by year */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden max-h-[480px] overflow-y-auto">
                {Object.entries(byYear)
                  .sort(([a], [b]) => parseInt(b) - parseInt(a))
                  .map(([year, items]) => (
                    <div key={year}>
                      <div className="sticky top-0 bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                        {year}
                      </div>
                      {items.map((b) => {
                        const isSelected = selectedBilten?.url === b.url;
                        return (
                          <button
                            key={b.url}
                            onClick={() => handleSelect(b)}
                            className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors hover:bg-[var(--surface)] border-b border-[var(--border)] last:border-0"
                            style={{ background: isSelected ? "var(--brand-primary-light)" : undefined }}
                          >
                            <span className="text-sm text-[var(--ink)] truncate">{b.filename}</span>
                            <div className="flex gap-2 shrink-0">
                              {b.isExternal && (
                                <span className="text-[0.65rem] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--surface)", color: "var(--subtle)", border: "1px solid var(--border)" }}>
                                  ext
                                </span>
                              )}
                              {b.is10m && (
                                <span className="text-[0.65rem] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)", border: "1px solid var(--border)" }}>
                                  10m
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
              </div>

              {/* Selected bilten config */}
              {selectedBilten && (
                <div className="rounded-xl border border-[var(--brand-primary)] p-5 space-y-4">
                  <p className="font-semibold text-sm text-[var(--ink)]">{selectedBilten.filename}</p>
                  <p className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] break-all">{selectedBilten.url}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Naziv takmičenja</label>
                      <input
                        value={compName}
                        onChange={(e) => setCompName(e.target.value)}
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum</label>
                      <DatePicker value={compDate} onChange={setCompDate} />
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
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Lokacija</label>
                      <input
                        value={compLocation}
                        onChange={(e) => setCompLocation(e.target.value)}
                        placeholder="npr. Beograd, SC Crvena zvezda"
                        className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={loading}
                    className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    {loading ? "Preuzimam i parsiram..." : "Uvezi bilten →"}
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
                      <button onClick={() => skipByNoc(noc)} className="text-[0.65rem] text-[var(--subtle)] hover:text-[var(--brand-primary)] transition-colors">
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
                  <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
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
                        <input type="checkbox" checked={!!row.skip} onChange={(e) => updateRow(trueIdx, { skip: e.target.checked })} className="accent-[var(--brand-primary)]" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={row.lastName} onChange={(e) => updateRow(trueIdx, { lastName: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={row.firstName} onChange={(e) => updateRow(trueIdx, { firstName: e.target.value })} className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5" />
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{row.clubAbbr ?? "—"}</td>
                      <td className="px-3 py-2">
                        <select value={row.disciplineCode} onChange={(e) => updateRow(trueIdx, { disciplineCode: e.target.value as ReviewRow["disciplineCode"] })} className="bg-transparent text-xs font-[family-name:var(--font-barlow-condensed)] font-semibold text-[var(--ink)] focus:outline-none">
                          {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">{row.qualRank != null ? `#${row.qualRank}` : "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" value={row.qualTotal} onChange={(e) => updateRow(trueIdx, { qualTotal: parseFloat(e.target.value) })} step="0.1" className="w-16 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] text-sm py-0.5" />
                      </td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs">{row.qualInners != null ? `${row.qualInners}x` : "—"}</td>
                      <td className="px-3 py-2">
                        {row.shooterId ? <span className="text-xs" style={{ color: "var(--success)" }}>✓ Pronađen</span>
                          : row.warning ? <span className="text-xs" style={{ color: "var(--warning)" }}>⚠ Novi</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={handleCommit} disabled={loading || activeCount === 0} className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50">
              {loading ? "Unosim..." : `Potvrdi i unesi ${activeCount} rezultata →`}
            </button>
            <button onClick={reset} className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">Otkaži</button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === "done" && result && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] p-8 text-center">
            <div className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-6xl mb-2" style={{ color: "var(--success)" }}>{result.inserted}</div>
            <p className="text-sm text-[var(--muted)]">rezultata uneto{result.skipped > 0 ? ` · ${result.skipped} preskočeno` : ""}</p>
            {result.errors.length > 0 && (
              <div className="mt-4 text-left rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="rounded-md px-5 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors">Uvezi još jedan bilten</button>
            <a href="/admin" className="rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">Admin panel</a>
          </div>
        </div>
      )}
    </div>
  );
}
