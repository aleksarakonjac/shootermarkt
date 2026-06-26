"use client";

import { useState } from "react";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

interface ISSFComp {
  id: number;
  name: string;
  dateFrom: string;
  dateTo: string;
  city: string;
  nationCode: string;
  nationName: string;
  alreadyInDb: boolean;
}

const LEVELS: { value: CompetitionLevel; label: string }[] = [
  { value: "medjunarodno", label: "Međunarodno" },
  { value: "drzavno", label: "Državno" },
  { value: "kup", label: "Kup" },
  { value: "regionalno", label: "Regionalno" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export function ISSFCompetitionSyncClient() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [comps, setComps] = useState<ISSFComp[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [levelOverride, setLevelOverride] = useState<CompetitionLevel>("medjunarodno");

  async function loadComps() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setLoaded(false);
    try {
      const res = await fetch(`/api/admin/issf/competitions/sync?year=${year}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setComps(data);
      setLoaded(true);
      // Auto-select ones not yet in DB
      setSelected(new Set(data.filter((c: ISSFComp) => !c.alreadyInDb).map((c: ISSFComp) => c.id)));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleAll() {
    const importable = comps.filter((c) => !c.alreadyInDb).map((c) => c.id);
    if (selected.size === importable.length) setSelected(new Set());
    else setSelected(new Set(importable));
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSync() {
    const toSync = comps
      .filter((c) => selected.has(c.id))
      .map((c) => ({ ...c, level: levelOverride }));
    if (!toSync.length) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/issf/competitions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitions: toSync }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setResult(data);
      setComps((prev) =>
        prev.map((c) => (selected.has(c.id) ? { ...c, alreadyInDb: true } : c))
      );
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  const importable = comps.filter((c) => !c.alreadyInDb);
  const allSelected = importable.length > 0 && selected.size === importable.length;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          ISSF — Sync takmičenja
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Uvozi metadata takmičenja iz ISSF baze. Rezultate importuj odvojeno iz admin/issf.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          <span style={{ color: "var(--success)" }} className="font-semibold">{result.inserted} uvezeno</span>
          {result.skipped > 0 && (
            <span className="text-[var(--muted)] ml-2">· {result.skipped} preskočeno (već postoje)</span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-[var(--border)] p-5 mb-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Godina</label>
          <select
            value={year}
            onChange={(e) => { setYear(parseInt(e.target.value)); setLoaded(false); setComps([]); }}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Nivo (za sve)</label>
          <select
            value={levelOverride}
            onChange={(e) => setLevelOverride(e.target.value as CompetitionLevel)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
          >
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <button
          onClick={loadComps}
          disabled={loading}
          className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
        >
          {loading ? "Učitavam..." : "Učitaj sa ISSF"}
        </button>
      </div>

      {/* Results table */}
      {loaded && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">{comps.length}</span> takmičenja
              {importable.length < comps.length && (
                <span className="ml-2 text-[var(--subtle)]">· {comps.length - importable.length} već u bazi</span>
              )}
            </div>
            {selected.size > 0 && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {syncing ? "Uvozim..." : `Uvezi ${selected.size} →`}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            {comps.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--muted)]">Nema Rifle/Pistol takmičenja za {year}.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={importable.length === 0}
                        className="accent-[var(--brand-primary)]"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Naziv</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Datum</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Lokacija</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {comps.map((c) => (
                    <tr
                      key={c.id}
                      className={`transition-colors ${c.alreadyInDb ? "opacity-40" : "hover:bg-[var(--surface)] cursor-pointer"}`}
                      onClick={() => !c.alreadyInDb && toggle(c.id)}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          disabled={c.alreadyInDb}
                          onChange={() => toggle(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[var(--brand-primary)]"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[var(--ink)]">{c.name}</td>
                      <td className="px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                        {c.dateFrom.split("T")[0]}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">
                        {c.city}, {c.nationCode}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.alreadyInDb ? (
                          <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>
                            ✓ U bazi
                          </span>
                        ) : (
                          <span className="text-[0.7rem] text-[var(--subtle)]">Novi</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {selected.size > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {syncing ? "Uvozim..." : `Uvezi ${selected.size} takmičenja →`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
