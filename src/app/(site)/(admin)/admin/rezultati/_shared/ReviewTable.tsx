"use client";

import { CATEGORY_LABEL, DISCIPLINE_META, type AgeCategory, type ReviewRow } from "@/lib/pdf-import/types";
import { ShooterMatchCell } from "./ShooterMatchCell";

const ALL_DISCIPLINES = ["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW"] as const;
const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as AgeCategory[]).map((value) => ({ value, label: CATEGORY_LABEL[value] }));

interface Props {
  rows: ReviewRow[];
  nocFilter: string;
  onRowChange: (idx: number, patch: Partial<ReviewRow>) => void;
  onNocFilterChange: (noc: string) => void;
  onSkipNoc: (noc: string) => void;
}

interface IndexedRow {
  row: ReviewRow;
  index: number;
}

const stickyHeader = "sticky z-20 bg-[var(--surface)]";
const stickyCell = "sticky z-10 bg-[var(--bg)]";

function QualificationTable({ rows, onRowChange }: { rows: IndexedRow[]; onRowChange: Props["onRowChange"] }) {
  return (
    <div className="overflow-auto border-t border-[var(--border)]">
      <table className="w-full min-w-[1260px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
            <th className="px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kat.</th>
            {[1, 2, 3, 4, 5, 6].map((series) => <th key={series} className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">S{series}</th>)}
            <th className={`${stickyHeader} right-80 w-20 border-l border-[var(--border)] px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Rank</th>
            <th className={`${stickyHeader} right-56 w-24 px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Ukupno</th>
            <th className={`${stickyHeader} right-36 w-20 px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Inner tens</th>
            <th className={`${stickyHeader} right-0 w-36 px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map(({ row, index }) => {
            const series = row.qualSeries ?? [];
            return (
              <tr key={index} className={row.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!row.skip} onChange={(event) => onRowChange(index, { skip: event.target.checked })} className="accent-[var(--brand-primary)]" /></td>
                <td className="px-3 py-2"><input value={row.lastName} onChange={(event) => onRowChange(index, { lastName: event.target.value })} className="min-w-[90px] w-full border-b border-transparent bg-transparent py-0.5 text-sm text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className="px-3 py-2"><input value={row.firstName} onChange={(event) => onRowChange(index, { firstName: event.target.value })} className="min-w-[80px] w-full border-b border-transparent bg-transparent py-0.5 text-sm text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className="px-3 py-2"><input value={row.teamNoc} onChange={(event) => onRowChange(index, { teamNoc: event.target.value.toUpperCase().slice(0, 3) })} maxLength={3} className="w-12 border-b border-transparent bg-transparent py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className="px-3 py-2"><input value={row.clubAbbr ?? ""} onChange={(event) => onRowChange(index, { clubAbbr: event.target.value || undefined })} placeholder="—" className="min-w-[70px] w-full border-b border-transparent bg-transparent py-0.5 text-xs text-[var(--muted)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className="px-3 py-2"><select value={row.category} onChange={(event) => onRowChange(index, { category: event.target.value as ReviewRow["category"] })} className="bg-transparent text-xs text-[var(--ink)] focus:outline-none">{CATEGORY_OPTIONS.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></td>
                {[0, 1, 2, 3, 4, 5].map((seriesIndex) => <td key={seriesIndex} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{series[seriesIndex] ?? "—"}</td>)}
                <td className={`${stickyCell} right-80 w-20 border-l border-[var(--border)] px-3 py-2`}><input type="number" value={row.qualRank ?? ""} onChange={(event) => onRowChange(index, { qualRank: event.target.value ? parseInt(event.target.value) : undefined })} placeholder="—" className="w-12 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className={`${stickyCell} right-56 w-24 px-3 py-2`}><input type="number" value={row.qualTotal ?? ""} onChange={(event) => onRowChange(index, { qualTotal: parseFloat(event.target.value) || 0 })} step="0.1" className="w-16 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className={`${stickyCell} right-36 w-20 px-3 py-2`}><input type="number" value={row.qualInners ?? ""} onChange={(event) => onRowChange(index, { qualInners: event.target.value ? parseInt(event.target.value) : null })} placeholder="—" className="w-12 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className={`${stickyCell} right-0 w-36 px-3 py-2`}><ShooterMatchCell row={row} onChange={(patch) => onRowChange(index, patch)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FinalsTable({ rows, onRowChange }: { rows: IndexedRow[]; onRowChange: Props["onRowChange"] }) {
  if (rows.length === 0) return null;

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Finale</div>
      <div className="overflow-auto border-t border-[var(--border)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
            <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kval. rank</th>
            <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kval. ukupno</th>
            <th className={`${stickyHeader} right-24 w-24 border-l border-[var(--border)] px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Final rank</th>
            <th className={`${stickyHeader} right-0 w-24 px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Final ukupno</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map(({ row, index }) => (
              <tr key={index} className={row.skip ? "opacity-40" : "hover:bg-[var(--bg)]"}>
                <td className="px-3 py-2 font-medium text-[var(--ink)]">{row.lastName}</td>
                <td className="px-3 py-2 text-[var(--ink)]">{row.firstName}</td>
                <td className="px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{row.teamNoc}</td>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{row.qualRank ?? "—"}</td>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{row.qualTotal}</td>
                <td className={`${stickyCell} right-24 w-24 border-l border-[var(--border)] px-3 py-2`}><input type="number" value={row.finalRank ?? ""} onChange={(event) => onRowChange(index, { finalRank: event.target.value ? parseInt(event.target.value) : null })} placeholder="—" className="w-12 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className={`${stickyCell} right-0 w-24 px-3 py-2`}><input type="number" value={row.finalTotal ?? ""} onChange={(event) => onRowChange(index, { finalTotal: event.target.value ? parseFloat(event.target.value) : null })} step="0.1" placeholder="—" className="w-16 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReviewTable({ rows, nocFilter, onRowChange, onNocFilterChange, onSkipNoc }: Props) {
  const allNocs = Array.from(new Set(rows.map((row) => row.teamNoc))).sort();
  const filtered = nocFilter ? rows.filter((row) => row.teamNoc === nocFilter) : rows;
  const byDiscipline = ALL_DISCIPLINES.map((discipline) => ({
    discipline,
    rows: filtered.flatMap((row) => row.disciplineCode === discipline ? [{ row, index: rows.indexOf(row) }] : []),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-5">
      {allNocs.length > 1 ? <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja:</span>
        <button onClick={() => onNocFilterChange("")} className="rounded-full px-3 py-1 text-xs font-semibold transition-colors" style={{ background: nocFilter === "" ? "var(--brand-primary)" : "var(--surface)", color: nocFilter === "" ? "white" : "var(--ink)" }}>Sve ({rows.length})</button>
        {allNocs.map((noc) => {
          const count = rows.filter((row) => row.teamNoc === noc).length;
          const skipped = rows.filter((row) => row.teamNoc === noc && row.skip).length;
          return <div key={noc} className="flex items-center gap-1">
            <button onClick={() => onNocFilterChange(nocFilter === noc ? "" : noc)} className="rounded-full px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold transition-colors" style={{ background: nocFilter === noc ? "var(--brand-accent)" : "var(--surface)", color: nocFilter === noc ? "white" : "var(--ink)" }}>{noc} ({count - skipped}/{count})</button>
            {skipped < count ? <button onClick={() => onSkipNoc(noc)} className="text-[0.65rem] text-[var(--subtle)] hover:text-[var(--brand-primary)]">skip sve</button> : null}
          </div>;
        })}
      </div> : null}

      {byDiscipline.map(({ discipline, rows: disciplineRows }) => {
        const finalRows = disciplineRows.filter(({ row }) => row.finalRank != null || row.finalTotal != null);
        return <section key={discipline} className="overflow-hidden rounded-lg border border-[var(--border)]">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--ink)]">{DISCIPLINE_META[discipline].label}</h3>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{disciplineRows.length} kvalifikacija</span>
          </div>
          <QualificationTable rows={disciplineRows} onRowChange={onRowChange} />
          <FinalsTable rows={finalRows} onRowChange={onRowChange} />
        </section>;
      })}
    </div>
  );
}
