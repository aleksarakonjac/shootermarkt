"use client";

import { useState } from "react";
import { CATEGORY_LABEL, DISCIPLINE_META, type AgeCategory, type ReviewRow } from "@/lib/pdf-import/types";
import { REVIEW_DISCIPLINE_CODES } from "@/lib/discipline";
import { NOC_LIST } from "@/lib/noc-list";
import { ShooterMatchCell } from "./ShooterMatchCell";
import { UnmatchedPanel } from "./UnmatchedPanel";

const COLLAPSE_AT = 10;

const isQualDecimal = (code: string) => code.startsWith("AR");
const isFinalDecimal = (code: string) => code.startsWith("AR") || code.startsWith("R3P") || code.startsWith("AP");
const fmtScore = (v: number, code: string) =>
  isQualDecimal(code) ? v.toFixed(1) : String(Math.round(v));
const fmtFinal = (v: number, code: string) =>
  isFinalDecimal(code) ? v.toFixed(1) : String(Math.round(v));
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
const stickyDivider = "border-l-2 border-[var(--border-strong)] [box-shadow:-8px_0_12px_-6px_rgba(0,0,0,0.12)]";

export function NocFlag({ noc }: { noc: string }) {
  const alpha2 = NOC_LIST.find((country) => country.noc === noc)?.alpha2;
  return alpha2 ? <span className={`fi fi-${alpha2.toLowerCase()} shrink-0`} style={{ width: "14px", height: "10px", borderRadius: "1px" }} /> : null;
}

function ShotBreakdown({ groups, prefix = "S" }: { groups?: number[][] | null; prefix?: string }) {
  const shotCount = groups?.reduce((count, group) => count + group.length, 0) ?? 0;
  if (shotCount === 0) return <span className="text-xs text-[var(--subtle)]">—</span>;

  return (
    <details className="group relative">
      <summary className="cursor-pointer whitespace-nowrap text-xs font-semibold text-[var(--brand-primary)] marker:hidden">
        {shotCount} hitaca
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 shadow-lg">
        <div className="space-y-2">
          {groups!.map((shots, index) => (
            <div key={index} className="flex gap-1.5">
              <span className="w-6 pt-0.5 text-xs font-semibold text-[var(--muted)]">{prefix}{index + 1}</span>
              <div className="flex flex-wrap gap-1">
                {shots.map((shot, shotIndex) => (
                  <span key={shotIndex} className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--ink)]">
                    {shot}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function QualificationTable({ rows, onRowChange }: { rows: IndexedRow[]; onRowChange: Props["onRowChange"] }) {
  const isR3P = rows[0]?.row.disciplineCode.startsWith("R3P") ?? false;
  return (
    <div className="overflow-x-auto border-t border-[var(--border)]">
      <table className="w-full min-w-[1260px] text-sm">
        <thead>
          {isR3P && (
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
              <th colSpan={7} />
              {R3P_POSITION_LABELS.map((label) => (
                <th key={label} colSpan={2} className="px-3 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] border-l border-[var(--border)]">{label}</th>
              ))}
              <th colSpan={3} />
            </tr>
          )}
          <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
            <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
            <th className="px-3 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kat.</th>
            {[1, 2, 3, 4, 5, 6].map((series) => <th key={series} className={`px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${isR3P && series % 2 === 1 ? "border-l border-[var(--border)]" : ""}`}>S{series}</th>)}
            <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inner tens</th>
            <th className={`${stickyHeader} ${stickyDivider} right-16 w-24 px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Ukupno</th>
            <th className={`${stickyHeader} right-0 w-16 px-3 py-2.5 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>St.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map(({ row, index }) => {
            const series = row.qualSeries ?? [];
            return (
              <tr key={index} className={row.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{row.qualRank ?? "—"}</td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!row.skip} onChange={(event) => onRowChange(index, { skip: event.target.checked })} className="accent-[var(--brand-primary)]" /></td>
                <td className="px-3 py-2"><input value={row.lastName} onChange={(event) => onRowChange(index, { lastName: event.target.value })} className="min-w-[90px] w-full border-b border-transparent bg-transparent py-0.5 text-sm text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className="px-3 py-2"><input value={row.firstName} onChange={(event) => onRowChange(index, { firstName: event.target.value })} className="min-w-[80px] w-full border-b border-transparent bg-transparent py-0.5 text-sm text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className="px-3 py-2"><div className="flex items-center gap-1.5"><NocFlag noc={row.teamNoc} /><input value={row.teamNoc} onChange={(event) => onRowChange(index, { teamNoc: event.target.value.toUpperCase().slice(0, 3) })} maxLength={3} className="w-12 border-b border-transparent bg-transparent py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold uppercase text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></div></td>
                <td className="px-3 py-2"><input value={row.clubAbbr ?? ""} onChange={(event) => onRowChange(index, { clubAbbr: event.target.value || undefined })} placeholder="—" className="min-w-[70px] w-full border-b border-transparent bg-transparent py-0.5 text-xs text-[var(--muted)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className="px-3 py-2"><select value={row.category} onChange={(event) => onRowChange(index, { category: event.target.value as ReviewRow["category"] })} className="bg-transparent text-xs text-[var(--ink)] focus:outline-none">{CATEGORY_OPTIONS.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></td>
                {[0, 1, 2, 3, 4, 5].map((seriesIndex) => <td key={seriesIndex} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{series[seriesIndex] != null ? fmtScore(series[seriesIndex], row.disciplineCode) : "—"}</td>)}
                <td className="px-3 py-2"><input type="number" value={row.qualInners ?? ""} onChange={(event) => onRowChange(index, { qualInners: event.target.value ? parseInt(event.target.value) : null })} placeholder="—" className="w-12 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className={`${stickyCell} ${stickyDivider} right-16 w-24 px-3 py-2`}><input type="number" value={row.qualTotal ?? ""} onChange={(event) => onRowChange(index, { qualTotal: parseFloat(event.target.value) || 0 })} step="0.1" className="w-16 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
                <td className={`${stickyCell} right-0 w-16 px-2 py-2 text-center`}><ShooterMatchCell row={row} onChange={(patch) => onRowChange(index, patch)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const R3P_POSITION_LABELS = ["Klečeći", "Ležeći", "Stojeći"];

function EliminationTable({ rows, onRowChange }: { rows: IndexedRow[]; onRowChange: Props["onRowChange"] }) {
  if (rows.length === 0) return null;
  const rounds = Array.from(new Set(rows.map(({ row }) => row.elimRound!))).sort((a, b) => a - b);

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Eliminacije</div>
      {rounds.map((round) => {
        const roundRows = rows
          .filter(({ row }) => row.elimRound === round)
          .sort((a, b) => (a.row.elimRank ?? 99) - (b.row.elimRank ?? 99));
        const seriesCount = Math.max(0, ...roundRows.map(({ row }) => row.elimSeries?.length ?? 0));
        const isR3PPositions = seriesCount === 6;
        return (
          <div key={round} className="border-t border-[var(--border)]">
            <div className="px-4 py-1.5 text-[0.7rem] font-semibold text-[var(--subtle)]">Runda {round} · {roundRows.length}</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  {isR3PPositions && (
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                      <th colSpan={5} />
                      {R3P_POSITION_LABELS.map((label) => (
                        <th key={label} colSpan={2} className="px-3 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] border-l border-[var(--border)]">{label}</th>
                      ))}
                      <th colSpan={2} />
                    </tr>
                  )}
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-3 py-2 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
                    <th className="px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
                    <th className="px-3 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
                    <th className="px-3 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
                    <th className="px-3 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                    {Array.from({ length: seriesCount }, (_, i) => <th key={i} className={`px-3 py-2 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${isR3PPositions && i % 2 === 0 ? "border-l border-[var(--border)]" : ""}`}>S{i + 1}</th>)}
                    <th className="px-3 py-2 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inner tens</th>
                    <th className="px-3 py-2 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ukupno</th>
                    <th className="px-3 py-2 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">St.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {roundRows.map(({ row, index }) => (
                    <tr key={index} className={row.skip ? "opacity-40" : "hover:bg-[var(--bg)]"}>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">{row.elimRank ?? "—"}</td>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!row.skip} onChange={(event) => onRowChange(index, { skip: event.target.checked })} className="accent-[var(--brand-primary)]" /></td>
                      <td className="px-3 py-2 font-medium text-[var(--ink)]">{row.lastName}</td>
                      <td className="px-3 py-2 text-[var(--ink)]">{row.firstName}</td>
                      <td className="px-3 py-2"><span className="flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]"><NocFlag noc={row.teamNoc} />{row.teamNoc}</span></td>
                      {Array.from({ length: seriesCount }, (_, i) => <td key={i} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{row.elimSeries?.[i] != null ? Math.round(row.elimSeries[i]) : "—"}</td>)}
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{row.elimInners != null ? `${row.elimInners}×` : "—"}</td>
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)]">{row.elimTotal != null ? Math.round(row.elimTotal) : "—"}</td>
                      <td className="px-2 py-2 text-center"><ShooterMatchCell row={row} onChange={(patch) => onRowChange(index, patch)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FinalsTable({ rows, onRowChange }: { rows: IndexedRow[]; onRowChange: Props["onRowChange"] }) {
  if (rows.length === 0) return null;
  const isHitCountFinal = rows[0]?.row.disciplineCode === "SPW";
  const finalValues = (row: ReviewRow) => row.finalCumulative ?? row.finalSeries ?? [];
  const intermediateCount = Math.max(...rows.map(({ row }) => Math.max(row.finalCumulative?.length ?? 0, row.finalSeries?.length ?? 0)));
  const intermediateLabel = isHitCountFinal ? "Gore: ukupno pogodaka. Dole: pogodaka u seriji." : rows.some(({ row }) => row.finalCumulative?.length) ? "Tok finala" : "Međuserije";

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Finale</div>
      <div className="overflow-x-auto border-t border-[var(--border)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
            <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Prezime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ime</th>
            <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
            <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kval. rank</th>
            <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kval. ukupno</th>
            {Array.from({ length: intermediateCount }, (_, index) => <th key={index} className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]" title={intermediateLabel}>{rows[0]?.row.finalSeriesLabels?.[index] ?? `F${index + 1}`}</th>)}
            {!isHitCountFinal ? <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Hici</th> : null}
            <th className={`${stickyHeader} ${stickyDivider} right-0 w-24 px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>{isHitCountFinal ? "Pogoci" : "Final ukupno"}</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {[...rows].sort((a, b) => (a.row.finalRank ?? 99) - (b.row.finalRank ?? 99)).map(({ row, index }) => {
              const values = finalValues(row);
              return <tr key={index} className={row.skip ? "opacity-40" : "hover:bg-[var(--bg)]"}>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">{row.finalRank ?? "—"}</td>
                <td className="px-3 py-2 font-medium text-[var(--ink)]">{row.lastName}</td>
                <td className="px-3 py-2 text-[var(--ink)]">{row.firstName}</td>
                <td className="px-3 py-2"><span className="flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]"><NocFlag noc={row.teamNoc} />{row.teamNoc}</span></td>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{row.qualRank ?? "—"}</td>
                <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{row.qualTotal != null ? fmtScore(row.qualTotal, row.disciplineCode) : "—"}</td>
                {Array.from({ length: intermediateCount }, (_, valueIndex) => isHitCountFinal ? <td key={valueIndex} className="px-3 py-1 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums"><div className="font-bold text-[var(--ink)]">{row.finalCumulative?.[valueIndex] ?? "—"}</div><div className="text-[var(--muted)]">{row.finalSeries?.[valueIndex] != null ? fmtFinal(row.finalSeries[valueIndex], row.disciplineCode) : "—"}</div></td> : <td key={valueIndex} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{values[valueIndex] != null ? fmtFinal(values[valueIndex], row.disciplineCode) : "—"}</td>)}
                {!isHitCountFinal ? <td className="px-3 py-2"><ShotBreakdown groups={row.finalShotsByStage ?? (row.finalShots ? [row.finalShots] : null)} prefix="F" /></td> : null}
                <td className={`${stickyCell} ${stickyDivider} right-0 w-24 px-3 py-2`}><input type="number" value={row.finalTotal ?? ""} onChange={(event) => onRowChange(index, { finalTotal: event.target.value ? parseFloat(event.target.value) : null })} step="0.1" placeholder="—" className="w-16 border-b border-transparent bg-transparent py-0.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)] hover:border-[var(--border)] focus:border-[var(--brand-primary)] focus:outline-none" /></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReviewTable({ rows, nocFilter, onRowChange, onNocFilterChange, onSkipNoc }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const allNocs = Array.from(new Set(rows.map((row) => row.teamNoc))).sort();
  const filtered = nocFilter ? rows.filter((row) => row.teamNoc === nocFilter) : rows;
  const byDiscipline = REVIEW_DISCIPLINE_CODES.map((discipline) => ({
    discipline,
    rows: filtered.flatMap((row) => row.disciplineCode === discipline ? [{ row, index: rows.indexOf(row) }] : []),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-5">
      <UnmatchedPanel rows={rows} onRowChange={onRowChange} />
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
        const qualRows = disciplineRows.filter(({ row }) => row.qualTotal != null);
        const elimRows = disciplineRows.filter(({ row }) => row.elimRound != null);
        const finalRows = disciplineRows.filter(({ row }) => row.finalRank != null || row.finalTotal != null);
        const isExpanded = expanded.has(discipline);
        const visibleRows = isExpanded ? qualRows : qualRows.slice(0, COLLAPSE_AT);
        const hiddenCount = qualRows.length - COLLAPSE_AT;
        return <section key={discipline} className="overflow-hidden rounded-lg border border-[var(--border)]">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--ink)]">{DISCIPLINE_META[discipline].label}</h3>
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                {qualRows.length > 0 ? `${qualRows.length} kvalifikacija` : `${disciplineRows.length} za unos`}
              </span>
              {qualRows.length > 0 && hiddenCount > 0 && (
                <button
                  onClick={() => setExpanded((prev) => {
                    const next = new Set(prev);
                    if (isExpanded) next.delete(discipline); else next.add(discipline);
                    return next;
                  })}
                  className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                >
                  {isExpanded ? "Skupi ↑" : `Prikaži sve ${qualRows.length} ↓`}
                </button>
              )}
            </div>
          </div>
          {qualRows.length > 0 && <QualificationTable rows={visibleRows} onRowChange={onRowChange} />}
          <EliminationTable rows={elimRows} onRowChange={onRowChange} />
          <FinalsTable rows={finalRows} onRowChange={onRowChange} />
        </section>;
      })}
    </div>
  );
}
