"use client";

import { useEffect, useState } from "react";
import type { ReviewRow, CompetitionLevel, DisciplineCode } from "@/lib/pdf-import/types";
import { DonePanel } from "../_shared/DonePanel";
import { SearchDropdown } from "@/components/ui/SearchDropdown";

const ALL_DISCIPLINES: DisciplineCode[] = ["ARM", "ARW", "APM", "APW", "RFM", "RFW", "R3JM", "R3JW", "SPW", "RFPM", "FPM"];

const LEVEL_LABELS: Record<CompetitionLevel, string> = {
  national:      "Državno",
  regional:      "Regionalno",
  international: "Međunarodno",
  continental:   "Kontinentalno",
  world:         "ISSF – Svetsko",
  club:          "Klubsko",
  olympic:       "Olimpijsko",
};

interface Competition {
  id: number;
  name: string;
  date: string;
  location: string | null;
  level: CompetitionLevel;
}

interface CommitResult { inserted: number; skipped: number; errors: string[]; competitionId: number }

function makeRow(): ReviewRow {
  return { firstName: "", lastName: "", teamNoc: "SRB", disciplineCode: "ARM", qualTotal: 0, qualRank: undefined, skip: false };
}

const INPUT = "w-full border-0 border-b border-[var(--border)] bg-transparent px-1 py-0.5 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors placeholder:text-[var(--subtle)]";
const TH = "px-2 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]";
const TD = "px-2 py-1.5 align-middle";

export function ManualMode() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compsLoading, setCompsLoading] = useState(true);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);

  const [rows, setRows] = useState<ReviewRow[]>([makeRow()]);

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((r) => r.json())
      .then((data) => setCompetitions(Array.isArray(data) ? data : []))
      .catch(() => setCompetitions([]))
      .finally(() => setCompsLoading(false));
  }, []);

  function handleSelectComp(id: string) {
    const comp = competitions.find((c) => String(c.id) === id) ?? null;
    setSelectedComp(comp);
  }

  function updateRow(idx: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const last = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      { ...makeRow(), disciplineCode: last?.disciplineCode ?? "ARM", teamNoc: last?.teamNoc ?? "SRB" },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function duplicateRow(idx: number) {
    const row = rows[idx];
    setRows((prev) => [...prev.slice(0, idx + 1), { ...row, firstName: "", lastName: "" }, ...prev.slice(idx + 1)]);
  }

  async function handleSubmit() {
    if (!selectedComp) { setError("Izaberi takmičenje"); return; }
    const activeRows = rows.filter((r) => !r.skip && r.firstName && r.lastName);
    if (activeRows.length === 0) { setError("Nema redova za unos"); return; }
    setLoading(true); setError(null);

    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: selectedComp.id,
          competition: {
            name: selectedComp.name,
            date: selectedComp.date,
            location: selectedComp.location ?? undefined,
            level: selectedComp.level,
          },
          rows: activeRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška pri unosu");
      setDone(data);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  function reset() {
    setDone(null); setError(null);
    setSelectedComp(null);
    setRows([makeRow()]);
  }

  if (done) {
    return <DonePanel result={done} onReset={reset} resetLabel="Unesi još jedno takmičenje" />;
  }

  const activeCount = rows.filter((r) => !r.skip && r.firstName && r.lastName).length;
  const compOptions = competitions.map((c) => ({
    value: String(c.id),
    label: c.name,
    sublabel: c.date,
  }));

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Competition picker */}
      <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">Takmičenje</h3>

        <div>
          <label className="block text-xs font-semibold text-[var(--muted)] mb-1">Izaberi takmičenje *</label>
          <SearchDropdown
            value={selectedComp ? String(selectedComp.id) : ""}
            onChange={handleSelectComp}
            options={compOptions}
            placeholder={compsLoading ? "Učitavam…" : "Pretraži takmičenje…"}
            emptyLabel="— izaberi —"
            searchPlaceholder="Pretraži naziv…"
            disabled={compsLoading}
          />
        </div>

        {selectedComp && (
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-[var(--surface)] px-4 py-3 text-sm">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--subtle)] mb-0.5">Datum</p>
              <p className="text-[var(--ink)] font-[family-name:var(--font-jetbrains-mono)]">{selectedComp.date}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--subtle)] mb-0.5">Nivo</p>
              <p className="text-[var(--ink)]">{LEVEL_LABELS[selectedComp.level] ?? selectedComp.level}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--subtle)] mb-0.5">Lokacija</p>
              <p className="text-[var(--ink)]">{selectedComp.location ?? "—"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--muted)]">{rows.length} redova · {activeCount} za unos</span>
          <button
            onClick={() => setRows([makeRow()])}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors px-2 py-1 rounded"
          >
            Obriši sve
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <th className={TH} style={{ width: 32 }}></th>
                <th className={TH} style={{ width: 90 }}>Disciplina</th>
                <th className={TH}>Prezime</th>
                <th className={TH}>Ime</th>
                <th className={TH} style={{ width: 80 }}>Klub</th>
                <th className={TH} style={{ width: 52 }}>NOC</th>
                <th className={TH} style={{ width: 68 }}>Ukupno</th>
                <th className={TH} style={{ width: 52 }}>Rank</th>
                <th className={TH} style={{ width: 52 }}>Inners</th>
                <th className={TH} style={{ width: 68 }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="group transition-colors"
                  style={{ opacity: row.skip ? 0.45 : 1, background: row.skip ? "var(--surface)" : undefined }}
                >
                  <td className={TD}>
                    <button
                      onClick={() => updateRow(idx, { skip: !row.skip })}
                      title={row.skip ? "Aktiviraj" : "Preskoči"}
                      className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-[var(--subtle)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
                    >
                      {row.skip ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M1 5h8M5 1v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </button>
                  </td>

                  <td className={TD}>
                    <select
                      value={row.disciplineCode}
                      onChange={(e) => updateRow(idx, { disciplineCode: e.target.value as DisciplineCode })}
                      disabled={row.skip}
                      className="font-[family-name:var(--font-jetbrains-mono)] text-xs rounded border-0 bg-transparent px-0 py-0.5 text-[var(--ink)] focus:outline-none focus:bg-[var(--surface)] cursor-pointer w-full"
                    >
                      {ALL_DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>

                  <td className={TD}>
                    <input value={row.lastName} onChange={(e) => updateRow(idx, { lastName: e.target.value })} disabled={row.skip} placeholder="Prezime" className={INPUT} />
                  </td>
                  <td className={TD}>
                    <input value={row.firstName} onChange={(e) => updateRow(idx, { firstName: e.target.value })} disabled={row.skip} placeholder="Ime" className={INPUT} />
                  </td>
                  <td className={TD}>
                    <input value={row.clubAbbr ?? ""} onChange={(e) => updateRow(idx, { clubAbbr: e.target.value })} disabled={row.skip} placeholder="SKP1813" className={INPUT} />
                  </td>
                  <td className={TD}>
                    <input
                      value={row.teamNoc}
                      onChange={(e) => updateRow(idx, { teamNoc: e.target.value.toUpperCase().slice(0, 3) })}
                      disabled={row.skip} maxLength={3}
                      className={`${INPUT} font-[family-name:var(--font-jetbrains-mono)] text-xs`}
                    />
                  </td>
                  <td className={TD}>
                    <input
                      type="number" value={row.qualTotal || ""} onChange={(e) => updateRow(idx, { qualTotal: parseFloat(e.target.value) || 0 })}
                      disabled={row.skip} placeholder="630.5" step="0.1"
                      className={`${INPUT} font-[family-name:var(--font-jetbrains-mono)] text-xs`}
                    />
                  </td>
                  <td className={TD}>
                    <input
                      type="number" value={row.qualRank ?? ""} onChange={(e) => updateRow(idx, { qualRank: parseInt(e.target.value) || undefined })}
                      disabled={row.skip} placeholder="1" min={1}
                      className={`${INPUT} font-[family-name:var(--font-jetbrains-mono)] text-xs`}
                    />
                  </td>
                  <td className={TD}>
                    <input
                      type="number" value={row.qualInners ?? ""} onChange={(e) => updateRow(idx, { qualInners: parseInt(e.target.value) || null })}
                      disabled={row.skip} placeholder="—" min={0}
                      className={`${INPUT} font-[family-name:var(--font-jetbrains-mono)] text-xs`}
                    />
                  </td>

                  <td className={TD}>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => duplicateRow(idx)} title="Dupliraj red" className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      </button>
                      <button onClick={() => removeRow(idx)} title="Obriši red" disabled={rows.length === 1} className="w-6 h-6 rounded flex items-center justify-center text-[var(--subtle)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M5 9.5V5M7 9.5V5M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[var(--border)] px-3 py-2">
          <button onClick={addRow} className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors py-1 px-2 rounded hover:bg-[var(--surface)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Dodaj strelca
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading || activeCount === 0 || !selectedComp}
          className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
        >
          {loading ? "Unosim…" : `Sačuvaj ${activeCount} rezultata →`}
        </button>
        <button onClick={reset} className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">
          Resetuj
        </button>
      </div>
    </div>
  );
}
