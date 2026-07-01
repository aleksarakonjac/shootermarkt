"use client";

import { useState, useRef } from "react";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { NOC_LIST } from "@/components/ui/NocDropdown";

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

interface BulkResult { noc: string; inserted: number; skipped: number; total: number }

export function ISSFAthleteImportClient() {
  const [query, setQuery] = useState("");
  const [athletes, setAthletes] = useState<ISSFAthlete[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  // Bulk nation import
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [selectedNoc, setSelectedNoc] = useState("SRB");

  // Scan all
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; noc: string } | null>(null);
  const scanAbortRef = useRef(false);

  async function handleScanAll() {
    scanAbortRef.current = false;
    setScanRunning(true);
    setScanProgress({ current: 0, total: NOC_LIST.length, noc: "" });
    for (let i = 0; i < NOC_LIST.length; i++) {
      if (scanAbortRef.current) break;
      const { noc } = NOC_LIST[i];
      setScanProgress({ current: i + 1, total: NOC_LIST.length, noc });
      try {
        const res = await fetch("/api/admin/issf/athletes/bulk-nation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noc }),
        });
        const data = await res.json();
        if (res.ok && data.total > 0) {
          setBulkResults((prev) => [{ noc, ...data }, ...prev.filter((r) => r.noc !== noc)]);
        }
      } catch {
        // skip failed nations silently
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    setScanRunning(false);
    setScanProgress(null);
  }

  async function handleBulkNation(noc: string) {
    setBulkLoading(noc);
    try {
      const res = await fetch("/api/admin/issf/athletes/bulk-nation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setBulkResults((prev) => [{ noc, ...data }, ...prev.filter((r) => r.noc !== noc)]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBulkLoading(null);
    }
  }

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

      {/* Bulk import po naciji */}
      <div className="rounded-xl border border-[var(--border)] p-4 mb-5 max-w-lg">
        <p className="text-sm font-semibold text-[var(--ink)] mb-1">Bulk import po naciji</p>
        <p className="text-xs text-[var(--muted)] mb-3">Uvozi sve strelce iz ISSF baze za izabranu naciju, ili skeniraj sve nacije odjednom.</p>

        {/* Single nation row */}
        <div className="flex gap-2 mb-3">
          <SearchDropdown
            value={selectedNoc}
            onChange={setSelectedNoc}
            options={NOC_LIST.map((n) => ({
              value: n.noc,
              label: n.noc,
              sublabel: n.name,
              prefix: (
                <span
                  className={`fi fi-${(n.alpha2 ?? "").toLowerCase()}`}
                  style={{ fontSize: "0.95em", borderRadius: "2px", flexShrink: 0 }}
                />
              ),
            }))}
            placeholder="Izaberi naciju..."
            emptyLabel="— izaberi —"
            searchPlaceholder="Pretraži naciju..."
            className="flex-1"
          />
          <button
            onClick={() => handleBulkNation(selectedNoc)}
            disabled={!!bulkLoading || scanRunning}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50 shrink-0"
          >
            {bulkLoading === selectedNoc ? (
              <><svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/></svg>Uvozim...</>
            ) : "Uvezi naciju"}
          </button>
        </div>

        {/* Scan all nations */}
        <div className="flex items-center gap-3 pt-3 border-t border-[var(--border)]">
          {scanRunning ? (
            <>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--muted)]">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">{scanProgress?.noc}</span>
                    <span className="ml-2">{scanProgress?.current}/{scanProgress?.total}</span>
                  </span>
                  <span className="text-xs text-[var(--subtle)]">{Math.round(((scanProgress?.current ?? 0) / (scanProgress?.total ?? 1)) * 100)}%</span>
                </div>
                <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${((scanProgress?.current ?? 0) / (scanProgress?.total ?? 1)) * 100}%`, background: "var(--brand-primary)" }}
                  />
                </div>
              </div>
              <button
                onClick={() => { scanAbortRef.current = true; }}
                className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Zaustavi
              </button>
            </>
          ) : (
            <button
              onClick={handleScanAll}
              disabled={!!bulkLoading}
              className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
            >
              Skeniraj celu ISSF bazu ({NOC_LIST.length} nacija)
            </button>
          )}
        </div>

        {bulkResults.length > 0 && (
          <div className="mt-3 rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden max-h-60 overflow-y-auto">
            {bulkResults.map((r) => (
              <div key={r.noc} className="flex items-center gap-3 px-3 py-2 bg-[var(--surface)]">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold text-[var(--ink)] w-10">{r.noc}</span>
                <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>+{r.inserted} uvezeno</span>
                {r.skipped > 0 && <span className="text-xs text-[var(--subtle)]">{r.skipped} preskočeno</span>}
                <span className="text-xs text-[var(--subtle)] ml-auto">{r.total} ukupno</span>
              </div>
            ))}
          </div>
        )}
      </div>

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
