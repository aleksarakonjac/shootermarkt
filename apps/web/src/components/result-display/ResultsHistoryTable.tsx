"use client";

import { Fragment, type ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useParams } from "next/navigation";
import type { ElimDetail, QualDetail, FinalDetail } from "@shootermarkt/db/schema";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { ResultDetailPanel } from "./ResultDetailPanel";

const MEDAL_COLOR: Record<number, string> = {
  1: "oklch(0.75 0.14 85)",
  2: "oklch(0.75 0.01 85)",
  3: "oklch(0.60 0.10 55)",
};

function formatCompetitionDate(date: string, dateEnd: string | null) {
  const [year, month, day] = date.split("-");
  if (!dateEnd || dateEnd === date) return `${day}.${month}.${year}.`;
  const [endYear, endMonth, endDay] = dateEnd.split("-");
  if (year === endYear && month === endMonth) return `${day}.-${endDay}.${month}.${year}.`;
  if (year === endYear) return `${day}.${month}.-${endDay}.${endMonth}.${year}.`;
  return `${day}.${month}.${year}.-${endDay}.${endMonth}.${endYear}.`;
}

export type ResultRowData = {
  id: number;
  competitionId: number;
  qualTotal: string | null;
  qualRank: number | null;
  qualInners: number | null;
  qualified: boolean | null;
  elimTotal: number | null;
  elimRank: number | null;
  elimRound: number | null;
  elimDetail: ElimDetail | null;
  finalTotal: string | null;
  finalRank: number | null;
  competitionName: string;
  competitionDate: string;
  competitionDateEnd: string | null;
  competitionLocation: string | null;
  competitionCountry: string | null;
  competitionCountryCode2: string | null;
  disciplineCode: string;
  category?: string | null;
  qualDetail: QualDetail | null;
  finalDetail: FinalDetail | null;
};

export function ResultsHistoryTable({ results, allLabel = "Sve", locale = "sr", toolbar, emptyContent }: { results: ResultRowData[]; allLabel?: string; locale?: string; toolbar?: ReactNode; emptyContent?: ReactNode }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedDisc, setSelectedDisc] = useState<string | null>(null);
  const scopedHref = useScopedHref();
  const params = useParams();
  const activeLocale = typeof params?.locale === "string" ? params.locale : "sr";

  const availableDiscs = Array.from(new Set(results.map(r => r.disciplineCode))).sort();
  const showFilter = availableDiscs.length > 1;

  function toggle(id: number) {
    setExpanded((prev) => {
      return prev.has(id) ? new Set() : new Set([id]);
    });
  }

  const sorted = [...results].reverse();
  const filtered = selectedDisc ? sorted.filter(r => r.disciplineCode === selectedDisc) : sorted;
  const groupedResults = selectedDisc
    ? filtered.map((result) => [result])
    : Array.from(filtered.reduce((groups, result) => {
        const group = groups.get(result.competitionId) ?? [];
        group.push(result);
        groups.set(result.competitionId, group);
        return groups;
      }, new Map<number, ResultRowData[]>()).values());

  return (
    <div className="rounded-xl border border-[var(--border)]">
      {(showFilter || toolbar) && (
        <div className="flex flex-nowrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:gap-1.5 sm:px-4">
          {showFilter && <div className="flex shrink-0 flex-nowrap gap-1 sm:gap-1.5">
          <button
            onClick={() => setSelectedDisc(null)}
            className={`text-[11px] font-extrabold font-[family-name:var(--font-barlow-condensed)] tracking-wider uppercase px-2.5 py-1 rounded transition-colors ${
              selectedDisc === null
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {allLabel}
          </button>
          {availableDiscs.map(code => (
            <button
              key={code}
              onClick={() => setSelectedDisc(code)}
              className={`text-[11px] font-extrabold font-[family-name:var(--font-barlow-condensed)] tracking-wider uppercase px-2.5 py-1 rounded transition-colors ${
                selectedDisc === code
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {code}
            </button>
          ))}
          </div>}
          {toolbar}
        </div>
      )}

      <div>
        <table className="w-full table-fixed text-xs sm:text-sm">
          <tbody>
            {groupedResults.length === 0 && emptyContent && <tr><td colSpan={4} className="px-4 py-16 text-center text-sm text-[var(--muted)]">{emptyContent}</td></tr>}
            {groupedResults.map((group) => {
              return (
                <Fragment key={`${group[0]!.competitionId}:${group[0]!.id}`}>
                  <tr>
                    <td colSpan={4} className="px-3 pb-0.5 pt-3 sm:px-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="min-w-0 flex-1 break-words font-semibold leading-snug text-[var(--ink)]">{group[0]!.competitionName}</span>
                        <span className="ml-auto whitespace-nowrap text-right font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-normal text-[var(--subtle)] sm:text-xs">{formatCompetitionDate(group[0]!.competitionDate, group[0]!.competitionDateEnd)}{group[0]!.competitionLocation && !group[0]!.competitionName.toLocaleLowerCase().includes(group[0]!.competitionLocation.toLocaleLowerCase()) && ` · ${group[0]!.competitionLocation}`}{group[0]!.competitionCountry && " · "}{group[0]!.competitionCountryCode2 && <span className={`fi fi-${group[0]!.competitionCountryCode2.toLowerCase()} inline-block mx-1`} style={{ width: "14px", height: "10px", borderRadius: "1px" }} />}{group[0]!.competitionCountry}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-3 pb-2.5 pt-0.5 sm:px-4 sm:pb-3 sm:pt-0.5">
                      <div className={`relative grid gap-y-2 ${selectedDisc ? "grid-cols-1" : "grid-cols-2"}`}>
                        {!selectedDisc && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[var(--border)]" />}
                        {group.map((r, index) => {
                          const isExpanded = expanded.has(r.id);
                          const canExpand = r.elimDetail != null || r.elimTotal != null || r.qualDetail != null || (r.finalDetail?.format === "bulletin" && (r.finalDetail.series?.length ?? 0) > 0);
                          const qualDecimals = r.disciplineCode.startsWith("AR");
                          const finalDecimals = r.disciplineCode.startsWith("AR") || r.disciplineCode.startsWith("R3P") || r.disciplineCode.startsWith("AP");
                          const showInners = r.disciplineCode !== "ARM" && r.disciplineCode !== "ARW";
                          const fmtQual = (v: string) => qualDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
                          const fmtFinal = (v: string) => finalDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
                          const showElimInsteadOfQual = r.qualTotal == null && r.elimTotal != null;

                          return <button key={r.id} type="button" disabled={!canExpand} onClick={canExpand ? () => toggle(r.id) : undefined} className={`grid min-w-0 grid-cols-2 gap-x-2 rounded-md py-1 text-left font-[family-name:var(--font-jetbrains-mono)] transition-colors ${index === 0 ? "pr-3" : "pl-3"} ${canExpand ? "cursor-pointer hover:bg-[var(--surface-2)]" : "cursor-default"} ${isExpanded ? "bg-[var(--surface-2)]" : ""}`} aria-expanded={canExpand ? isExpanded : undefined}>
                            <span className="flex min-w-0 flex-col items-start"><span className="flex items-center gap-1"><span className="inline-block rounded bg-[var(--surface-2)] px-1 py-0.5 font-[family-name:var(--font-barlow-condensed)] text-[0.65rem] font-semibold tracking-wide text-[var(--ink)] sm:px-2 sm:text-xs">{r.disciplineCode}</span><span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">{locale === "en" ? "Qual." : "Kval."}</span></span>{r.qualTotal != null ? <span className="mt-0.5 font-semibold text-[var(--ink)]">{fmtQual(r.qualTotal)}{showInners && r.qualInners != null && <span className="ml-0.5 text-[0.65rem] font-normal text-[var(--muted)]">{r.qualInners}×</span>}</span> : showElimInsteadOfQual ? <span className="mt-0.5 font-semibold text-[var(--ink)]">{Math.round(r.elimTotal!)}<span className="ml-1 inline-flex rounded bg-amber-100 px-1 py-px font-[family-name:var(--font-barlow-condensed)] text-[0.6rem] font-bold leading-none text-amber-800">E</span></span> : <span className="mt-0.5 text-[var(--subtle)]">—</span>}<span className="flex h-5 items-center text-[0.65rem] text-[var(--subtle)]">{r.qualRank != null ? `#${r.qualRank}` : r.elimRank != null ? `#${r.elimRank}` : ""}</span></span>
                            <span className="flex min-w-0 flex-col items-end text-[var(--muted)]"><span className="flex items-center gap-1"><span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">{locale === "en" ? "Final" : "Finale"}</span>{canExpand && <ChevronDown size={14} className={`text-[var(--muted)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />}</span><span className="mt-0.5">{r.finalTotal != null ? fmtFinal(r.finalTotal) : "—"}</span><span className="mt-0.5 flex h-5 items-center justify-end">{r.finalRank != null && (MEDAL_COLOR[r.finalRank] ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold text-white" style={{ background: MEDAL_COLOR[r.finalRank] }} aria-label={`Mesto ${r.finalRank}`}>{r.finalRank}</span> : <span className="text-[0.65rem] text-[var(--subtle)]">#{r.finalRank}</span>)}</span></span>
                          </button>;
                        })}
                      </div>
                    </td>
                  </tr>
                  {group.map((r) => {
                    const isExpanded = expanded.has(r.id);
                    const canExpand = r.elimDetail != null || r.elimTotal != null || r.qualDetail != null || (r.finalDetail?.format === "bulletin" && (r.finalDetail.series?.length ?? 0) > 0);
                    if (!canExpand) return null;
                    const qualDecimals = r.disciplineCode.startsWith("AR");
                    const finalDecimals = r.disciplineCode.startsWith("AR") || r.disciplineCode.startsWith("R3P") || r.disciplineCode.startsWith("AP");
                    const showInners = r.disciplineCode !== "ARM" && r.disciplineCode !== "ARW";
                    const fmtQual = (v: string) => qualDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
                    const fmtFinal = (v: string) => finalDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
                    const phaseHref = (stage: "elim" | "qual" | "final") => `/${activeLocale}${scopedHref(`/takmicenja/${r.competitionId}?result=individual&disc=${r.disciplineCode}&category=${r.category ?? "senior"}&stage=${stage}${stage === "elim" && r.elimRound != null ? `&round=${r.elimRound}` : ""}`)}`;
                    return <tr key={`detail-${r.id}`} aria-hidden={!isExpanded}><td colSpan={4} className="p-0"><div className={`grid transition-[grid-template-rows] duration-200 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}><div className="overflow-hidden"><ResultDetailPanel qualDetail={r.qualDetail} elimDetail={r.elimDetail} elimTotal={r.elimTotal} elimRank={r.elimRank} qualRank={r.qualRank} qualScore={r.qualTotal != null ? fmtQual(r.qualTotal) : null} disciplineCode={r.disciplineCode} locale={locale} finalDetail={r.finalDetail} finalScore={r.finalTotal != null ? fmtFinal(r.finalTotal) : null} finalRank={r.finalRank} hasDecimals={qualDecimals} inners={showInners ? r.qualInners : null} eliminationHref={phaseHref("elim")} qualificationHref={phaseHref("qual")} finalHref={phaseHref("final")} /></div></div></td></tr>;
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
