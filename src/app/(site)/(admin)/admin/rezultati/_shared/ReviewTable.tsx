"use client";

import { CATEGORY_LABEL, type AgeCategory, type ReviewRow } from "@/lib/pdf-import/types";
import { ShooterMatchCell } from "./ShooterMatchCell";

const ALL_DISCIPLINES = [
  "ARM","ARW","APM","APW","R3PM","R3PW","SPW",
] as const;

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as AgeCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}));

interface Props {
  rows: ReviewRow[];
  nocFilter: string;
  onRowChange: (idx: number, patch: Partial<ReviewRow>) => void;
  onNocFilterChange: (noc: string) => void;
  onSkipNoc: (noc: string) => void;
}

export function ReviewTable({
  rows,
  nocFilter,
  onRowChange,
  onNocFilterChange,
  onSkipNoc,
}: Props) {
  const allNocs = Array.from(new Set(rows.map((r) => r.teamNoc))).sort();
  const filtered = nocFilter ? rows.filter((r) => r.teamNoc === nocFilter) : rows;

  return (
    <div className="space-y-3">
      {/* Country filter */}
      {allNocs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja:</span>
          <button
            onClick={() => onNocFilterChange("")}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={{
              background: nocFilter === "" ? "var(--brand-primary)" : "var(--surface)",
              color: nocFilter === "" ? "white" : "var(--ink)",
            }}
          >
            Sve ({rows.length})
          </button>
          {allNocs.map((noc) => {
            const count = rows.filter((r) => r.teamNoc === noc).length;
            const skipped = rows.filter((r) => r.teamNoc === noc && r.skip).length;
            return (
              <div key={noc} className="flex items-center gap-1">
                <button
                  onClick={() => onNocFilterChange(nocFilter === noc ? "" : noc)}
                  className="rounded-full px-3 py-1 text-xs font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors"
                  style={{
                    background: nocFilter === noc ? "var(--brand-accent)" : "var(--surface)",
                    color: nocFilter === noc ? "white" : "var(--ink)",
                  }}
                >
                  {noc} ({count - skipped}/{count})
                </button>
                {skipped < count && (
                  <button
                    onClick={() => onSkipNoc(noc)}
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
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Disc.</th>
              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kat.</th>
              <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Rank</th>
              <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Total</th>
              <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inners</th>
              <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((row) => {
              const trueIdx = rows.indexOf(row);
              return (
                <tr
                  key={trueIdx}
                  className={`transition-colors ${row.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}`}
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!row.skip}
                      onChange={(e) => onRowChange(trueIdx, { skip: e.target.checked })}
                      className="accent-[var(--brand-primary)]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.lastName}
                      onChange={(e) => onRowChange(trueIdx, { lastName: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5 min-w-[90px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.firstName}
                      onChange={(e) => onRowChange(trueIdx, { firstName: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--ink)] text-sm py-0.5 min-w-[80px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.teamNoc}
                      onChange={(e) => onRowChange(trueIdx, { teamNoc: e.target.value.toUpperCase().slice(0, 3) })}
                      maxLength={3}
                      className="w-12 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)] bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none py-0.5 uppercase"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.clubAbbr ?? ""}
                      onChange={(e) => onRowChange(trueIdx, { clubAbbr: e.target.value || undefined })}
                      className="w-full bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none text-[var(--muted)] text-xs py-0.5 min-w-[70px]"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.disciplineCode}
                      onChange={(e) => onRowChange(trueIdx, { disciplineCode: e.target.value as ReviewRow["disciplineCode"] })}
                      className="bg-transparent text-xs font-[family-name:var(--font-barlow-condensed)] font-semibold text-[var(--ink)] focus:outline-none cursor-pointer"
                    >
                      {ALL_DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.category}
                      onChange={(e) => onRowChange(trueIdx, { category: e.target.value as ReviewRow["category"] })}
                      className="bg-transparent text-xs text-[var(--ink)] focus:outline-none cursor-pointer"
                    >
                      {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.qualRank ?? ""}
                      onChange={(e) => onRowChange(trueIdx, { qualRank: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-12 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs py-0.5"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.qualTotal ?? ""}
                      onChange={(e) => onRowChange(trueIdx, { qualTotal: parseFloat(e.target.value) || 0 })}
                      step="0.1"
                      className="w-16 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] text-sm py-0.5"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.qualInners ?? ""}
                      onChange={(e) => onRowChange(trueIdx, { qualInners: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-12 text-right bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-xs py-0.5"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <ShooterMatchCell row={row} onChange={(patch) => onRowChange(trueIdx, patch)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
