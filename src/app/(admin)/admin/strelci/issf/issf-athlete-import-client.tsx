"use client";

import { useState } from "react";

interface ISSFAthlete {
  issfId: string;
  firstName: string;
  familyName: string;
  nationCode: string;
  gender: string;
  birthday: string;
  portraitUrl: string;
  alreadyInDb: boolean;
}

const NOC_PRESETS = ["SRB", "CRO", "SLO", "HUN", "BIH", "MNE", "MKD", "ROU", "BUL", "GRE"];

export function ISSFAthleteImportClient() {
  const [query, setQuery] = useState("");
  const [athletes, setAthletes] = useState<ISSFAthlete[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  async function handleSearch(q?: string) {
    const term = q ?? query;
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/admin/issf/athletes?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setAthletes(data);
      setSearched(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggleAll() {
    const importable = athletes.filter((a) => !a.alreadyInDb).map((a) => a.issfId);
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable));
    }
  }

  function toggle(issfId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(issfId) ? next.delete(issfId) : next.add(issfId);
      return next;
    });
  }

  async function handleImport() {
    const toImport = athletes.filter((a) => selected.has(a.issfId));
    if (!toImport.length) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/issf/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athletes: toImport }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setResult(data);
      // Mark imported as alreadyInDb
      setAthletes((prev) =>
        prev.map((a) => (selected.has(a.issfId) ? { ...a, alreadyInDb: true } : a))
      );
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  const importable = athletes.filter((a) => !a.alreadyInDb);
  const allSelected = importable.length > 0 && selected.size === importable.length;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          ISSF — Bulk import strelaca
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Pretraži ISSF bazu po naciji ili imenu, odaberi strelce, uvezi u bazu
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
          {result.skipped > 0 && <span className="text-[var(--muted)] ml-2">· {result.skipped} preskočeno (već postoje)</span>}
        </div>
      )}

      {/* Search bar */}
      <div className="rounded-xl border border-[var(--border)] p-5 mb-5 space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="npr. Serbia, Marko, Petrović..."
            className="flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Tražim..." : "Pretraži"}
          </button>
        </div>

        {/* NOC quick-search */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider">Brza pretraga:</span>
          {NOC_PRESETS.map((noc) => (
            <button
              key={noc}
              onClick={() => { setQuery(noc); handleSearch(noc); }}
              className="rounded px-2.5 py-1 text-xs font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              {noc}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {searched && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">{athletes.length}</span> rezultata
              {importable.length < athletes.length && (
                <span className="ml-2 text-[var(--subtle)]">· {athletes.length - importable.length} već u bazi</span>
              )}
            </div>
            {selected.size > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {importing ? "Uvozim..." : `Uvezi ${selected.size} strelaca →`}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            {athletes.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--muted)]">Nema rezultata.</div>
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
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Pol</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">God.</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">ISSF ID</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {athletes.map((a) => (
                    <tr
                      key={a.issfId}
                      className={`transition-colors ${a.alreadyInDb ? "opacity-40" : "hover:bg-[var(--surface)]"}`}
                      onClick={() => !a.alreadyInDb && toggle(a.issfId)}
                      style={{ cursor: a.alreadyInDb ? "default" : "pointer" }}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(a.issfId)}
                          disabled={a.alreadyInDb}
                          onChange={() => toggle(a.issfId)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[var(--brand-primary)]"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-[var(--ink)]">
                        {a.familyName} {a.firstName}
                      </td>
                      <td className="px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">
                        {a.nationCode}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">
                        {a.gender === "Male" ? "M" : a.gender === "Female" ? "F" : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                        {a.birthday ? new Date(a.birthday).getFullYear() : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)]">
                        {a.issfId}
                      </td>
                      <td className="px-3 py-2.5">
                        {a.alreadyInDb ? (
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
                onClick={handleImport}
                disabled={importing}
                className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
              >
                {importing ? "Uvozim..." : `Uvezi ${selected.size} strelaca →`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
