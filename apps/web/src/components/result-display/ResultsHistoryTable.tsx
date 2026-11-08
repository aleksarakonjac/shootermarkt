"use client";

import { localizeMatchName } from "@/lib/match-name";
import { Fragment, type ReactNode, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useParams } from "next/navigation";
import type { ElimDetail, QualDetail, FinalDetail } from "@shootermarkt/db/schema";
import { CATEGORY_LABEL, escSoloPlacement, qualHasDecimals, type AgeCategory } from "@shootermarkt/db/pdf-import-types";
import { DISCIPLINE_DISPLAY_ORDER, disciplineName } from "@shootermarkt/db/discipline-names";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { ResultDetailPanel, finalSeriesValues } from "./ResultDetailPanel";

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
  /** Jedinstven ključ reda: "r:<results.id>" ili "m:<mixed_team_results.id>" (id-jevi iz dve tabele se preklapaju). */
  rowKey: string;
  kind: "individual" | "mixed" | "esc";
  /** Mešoviti tim: partner ("Ž. Petrović"). */
  partnerName?: string | null;
  /** Mešoviti tim: serije ovog strelca i partnera. */
  mixedDetail?: { own: { series: number[]; total: number } | null; partner: { series: number[]; total: number } | null } | null;
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
  /** Zaseban meč istog takmičenja (npr. memorijal drugog dana) */
  competitionEventId?: number | null;
  eventName?: string | null;
  qualDetail: QualDetail | null;
  finalDetail: FinalDetail | null;
};

const KIND_ORDER: Record<ResultRowData["kind"], number> = { individual: 0, mixed: 1, esc: 2 };
const disciplineIndex = (code: string) => {
  const index = DISCIPLINE_DISPLAY_ORDER.indexOf(code);
  return index === -1 ? DISCIPLINE_DISPLAY_ORDER.length : index;
};

/** Unutar takmičenja: pojedinačno (po programu) → mešoviti tim → ESC. Stabilno za redosled takmičenja. */
export function sortHistoryRows(rows: ResultRowData[]): ResultRowData[] {
  return [...rows].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || disciplineIndex(a.disciplineCode) - disciplineIndex(b.disciplineCode));
}

const CATEGORY_LABEL_EN: Partial<Record<AgeCategory, string>> = {
  pionir: "Pioneer", kadet: "Cadet (U16)", mladji_junior: "Youth (U18)", junior: "Junior (U21)", mladji_senior: "U23", master: "Master", open: "Open",
};

/** R3P varijanta iz broja serija: 3x20 ima 2 serije po stavu (6 ukupno), 3x40 ima 4 (12). */
function r3pVariant(detail: QualDetail | null): "3x20" | "3x40" | undefined {
  if (!detail) return undefined;
  if ("kneeling" in detail) return detail.kneeling.series.length <= 2 ? "3x20" : "3x40";
  if ("series" in detail) return detail.series.length <= 6 ? "3x20" : "3x40";
  return undefined;
}

const rowName = (r: ResultRowData, locale: string) => disciplineName(r.disciplineCode, locale, { variant: r3pVariant(r.qualDetail) });

function MedalOrRank({ rank, locale }: { rank: number | null; locale: string }) {
  if (rank == null) return null;
  return MEDAL_COLOR[rank]
    ? <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold text-white" style={{ background: MEDAL_COLOR[rank] }} aria-label={`${locale === "en" ? "Place" : "Mesto"} ${rank}`}>{rank}</span>
    : <span className="text-[0.65rem] text-[var(--subtle)]">#{rank}</span>;
}

function SeriesLine({ label, series, total }: { label: string; series: number[]; total: number | null }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="w-24 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">{label}</span>
      <span className="flex flex-wrap gap-x-2 font-[family-name:var(--font-jetbrains-mono)] tabular-nums text-[var(--muted)]">{series.map((v, i) => <span key={i}>{v}</span>)}</span>
      {total != null && <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold tabular-nums text-[var(--ink)]">{total}</span>}
    </div>
  );
}

export function ResultsHistoryTable({ results, allLabel = "Sve", locale = "sr", toolbar, emptyContent }: { results: ResultRowData[]; allLabel?: string; locale?: string; toolbar?: ReactNode; emptyContent?: ReactNode }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedDisc, setSelectedDisc] = useState<string | null>(null);
  const scopedHref = useScopedHref();
  const params = useParams();
  const activeLocale = typeof params?.locale === "string" ? params.locale : "sr";
  const reducedMotion = useReducedMotion();
  const selectorLayoutId = useId();
  const en = locale === "en";

  const availableDiscs = Array.from(new Set(results.map((r) => r.disciplineCode))).sort((a, b) => disciplineIndex(a) - disciplineIndex(b));
  const showFilter = availableDiscs.length > 1;
  const discLabel = (code: string) => rowName(results.find((r) => r.disciplineCode === code)!, locale);

  const sorted = [...results].reverse();
  const filtered = selectedDisc ? sorted.filter((r) => r.disciplineCode === selectedDisc) : sorted;
  const groupedResults = Array.from(filtered.reduce((groups, result) => {
    const group = groups.get(result.competitionId) ?? [];
    group.push(result);
    groups.set(result.competitionId, group);
    return groups;
  }, new Map<number, ResultRowData[]>()).values()).map(sortHistoryRows);

  const filterButton = (key: string | null, label: string) => (
    <button
      key={key ?? "all"}
      onClick={() => setSelectedDisc(key)}
      className={`relative shrink-0 overflow-hidden whitespace-nowrap rounded px-2.5 py-1 font-[family-name:var(--font-barlow-condensed)] text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
        selectedDisc === key ? "text-[var(--bg)]" : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {selectedDisc === key && <motion.span layoutId={`results-history-filter-${selectorLayoutId}`} className="absolute inset-0 rounded bg-[var(--ink)]" transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }} />}
      <span className="relative">{label}</span>
    </button>
  );

  return (
    <div className="rounded-xl border border-[var(--border)]">
      {(showFilter || toolbar) && (
        <div className="flex flex-nowrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:gap-1.5 sm:px-4">
          {showFilter && <div className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-1.5">
            {filterButton(null, allLabel)}
            {availableDiscs.map((code) => filterButton(code, discLabel(code)))}
          </div>}
          {toolbar}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selectedDisc ?? "all"}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: reducedMotion ? 0 : 0.16, ease: "easeOut" }}
        >
        <table className="w-full table-fixed text-xs sm:text-sm">
          <tbody>
            {groupedResults.length === 0 && emptyContent && <tr><td className="px-4 py-16 text-center text-sm text-[var(--muted)]">{emptyContent}</td></tr>}
            {groupedResults.map((group, groupIndex) => {
              const first = group[0]!;
              return (
                <Fragment key={`${first.competitionId}:${first.rowKey}`}>
                  <tr>
                    <td className={`px-3 pb-1 pt-3 sm:px-4 ${groupIndex > 0 ? "border-t border-[var(--border)]" : ""}`}>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="min-w-0 break-words font-semibold leading-snug text-[var(--ink)]">{first.competitionName}</span>
                        <span className="whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-normal text-[var(--subtle)] sm:text-xs">{formatCompetitionDate(first.competitionDate, first.competitionDateEnd)}{first.competitionLocation && !first.competitionName.toLocaleLowerCase().includes(first.competitionLocation.toLocaleLowerCase()) && ` · ${first.competitionLocation}`}{first.competitionCountry && " · "}{first.competitionCountryCode2 && <span className={`fi fi-${first.competitionCountryCode2.toLowerCase()} inline-block mx-1`} style={{ width: "14px", height: "10px", borderRadius: "1px" }} />}{first.competitionCountry}</span>
                      </div>
                    </td>
                  </tr>
                  {group.map((r, rowIndex) => {
                    const isLast = rowIndex === group.length - 1;
                    const isExpanded = expanded === r.rowKey;
                    const isSolo = r.kind === "esc";
                    const isMixed = r.kind === "mixed";
                    const canExpand = isMixed
                      ? r.mixedDetail?.own != null || r.mixedDetail?.partner != null
                      : r.elimDetail != null || r.elimTotal != null || r.qualDetail != null || (r.finalDetail != null && finalSeriesValues(r.finalDetail) != null);
                    const qualDecimals = qualHasDecimals(r.disciplineCode);
                    const finalDecimals = !isSolo && (r.disciplineCode.startsWith("AR") || r.disciplineCode.startsWith("R3P") || r.disciplineCode.startsWith("AP"));
                    const showInners = !isSolo && r.disciplineCode !== "ARM" && r.disciplineCode !== "ARW" && r.disciplineCode !== "ARMT";
                    const fmtQual = (v: string) => qualDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
                    const fmtFinal = (v: string) => finalDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
                    const showElimInsteadOfQual = r.qualTotal == null && r.elimTotal != null;
                    const categoryLabel = r.category && r.category !== "senior" ? (en ? CATEGORY_LABEL_EN[r.category as AgeCategory] : CATEGORY_LABEL[r.category as AgeCategory]) ?? null : null;
                    const extra = isMixed
                      ? (r.partnerName ? `${en ? "with" : "sa"} ${r.partnerName}` : null)
                      : isSolo ? "ESC Challenge" : null;
                    const soloFinal = isSolo && r.finalDetail && "opponentTotal" in r.finalDetail ? r.finalDetail : null;
                    const placement = isSolo ? escSoloPlacement(r) : null;
                    // Druga linija na telefonu samo kad ima šta da pokaže (dodatak ili finale/meč).
                    const hasFinalCell = isSolo ? placement != null || r.finalTotal != null : r.finalTotal != null || r.finalRank != null;
                    const hasLine2 = Boolean(extra || categoryLabel || r.eventName || hasFinalCell);
                    const phaseHref = (stage: "elim" | "qual" | "final") => `/${activeLocale}${scopedHref(`/takmicenja/${r.competitionId}?result=individual&disc=${r.competitionEventId ? `${r.disciplineCode}@${r.competitionEventId}` : r.disciplineCode}&category=${r.category ?? "senior"}&stage=${stage}${stage === "elim" && r.elimRound != null ? `&round=${r.elimRound}` : ""}`)}`;

                    return (
                      <Fragment key={r.rowKey}>
                        <tr>
                          <td className={`px-1.5 sm:px-2 ${isLast && !isExpanded ? "pb-2.5 sm:pb-3" : ""}`}>
                            <button
                              type="button"
                              disabled={!canExpand}
                              onClick={canExpand ? () => setExpanded(isExpanded ? null : r.rowKey) : undefined}
                              aria-expanded={canExpand ? isExpanded : undefined}
                              className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-md px-1.5 py-1.5 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_7.5rem_8.5rem] sm:px-2 ${canExpand ? "cursor-pointer hover:bg-[var(--surface-2)]" : "cursor-default"} ${isExpanded ? "bg-[var(--surface-2)]" : ""}`}
                            >
                              <span className="order-1 min-w-0 font-medium leading-snug text-[var(--ink)]">{rowName(r, locale)}</span>
                              <span className="order-3 min-w-0 truncate text-[0.7rem] text-[var(--muted)] sm:order-2 sm:text-xs">
                                {[extra, categoryLabel].filter(Boolean).join(" · ")}
                                {r.eventName && <span className="ml-1 font-semibold text-[var(--brand-primary)]" title={r.eventName}>{localizeMatchName(r.eventName, locale)}</span>}
                              </span>
                              <span className="order-2 flex items-baseline justify-end gap-1 whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] tabular-nums sm:order-3">
                                {r.qualTotal != null
                                  ? <span className="font-semibold text-[var(--ink)]">{isSolo ? `${fmtQual(r.qualTotal)} ${en ? "hits" : "pog."}` : fmtQual(r.qualTotal)}{showInners && r.qualInners != null && <span className="ml-0.5 text-[0.65rem] font-normal text-[var(--muted)]">{r.qualInners}×</span>}</span>
                                  : showElimInsteadOfQual
                                    ? <span className="font-semibold text-[var(--ink)]">{Math.round(r.elimTotal!)}<span className="ml-1 inline-flex rounded bg-amber-100 px-1 py-px font-[family-name:var(--font-barlow-condensed)] text-[0.6rem] font-bold leading-none text-amber-800">E</span></span>
                                    : <span className="text-[var(--subtle)]">—</span>}
                                <span className="text-[0.65rem] text-[var(--subtle)]">{r.qualRank != null ? `#${r.qualRank}` : r.elimRank != null ? `#${r.elimRank}` : ""}</span>
                                {canExpand && !hasLine2 && <ChevronDown size={14} className={`shrink-0 self-center text-[var(--muted)] transition-transform duration-200 sm:hidden ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />}
                              </span>
                              <span className={`order-4 ${hasLine2 ? "flex" : "max-sm:hidden sm:flex"} items-center justify-end gap-1.5 whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] text-[0.7rem] tabular-nums text-[var(--muted)] sm:text-xs`}>
                                {isSolo ? (
                                  soloFinal && r.finalTotal != null
                                    ? <><MedalOrRank rank={r.finalRank} locale={locale} /><span>{en ? "match" : "meč"} {Math.round(parseFloat(r.finalTotal))} : {soloFinal.opponentTotal ?? "—"}</span></>
                                    : placement != null ? <span>{en ? `place ${placement}` : `${placement}. mesto`}</span> : null
                                ) : r.finalTotal != null || r.finalRank != null ? (
                                  <><span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">{en ? "Final" : "Finale"}</span>{r.finalTotal != null && <span>{fmtFinal(r.finalTotal)}</span>}<MedalOrRank rank={r.finalRank} locale={locale} /></>
                                ) : null}
                                {canExpand && <ChevronDown size={14} className={`shrink-0 text-[var(--muted)] transition-transform duration-200 ${hasLine2 ? "" : "max-sm:hidden"} ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {canExpand && (
                          <tr aria-hidden={!isExpanded}>
                            <td className="p-0">
                              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                                <div className="overflow-hidden">
                                  {isMixed ? (
                                    <div className="space-y-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs">
                                      {r.mixedDetail?.own && <SeriesLine label={en ? "You" : "Strelac"} series={r.mixedDetail.own.series} total={r.mixedDetail.own.total} />}
                                      {r.mixedDetail?.partner && <SeriesLine label={r.partnerName ?? (en ? "Partner" : "Partner")} series={r.mixedDetail.partner.series} total={r.mixedDetail.partner.total} />}
                                    </div>
                                  ) : isSolo && r.qualDetail && "format" in r.qualDetail ? (
                                    <div className="space-y-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs">
                                      <SeriesLine label={en ? "Qual. 1" : "Kval. 1"} series={r.qualDetail.part1.series} total={r.qualDetail.part1.total} />
                                      {r.qualDetail.part2 && <SeriesLine label={en ? "Qual. 2" : "Kval. 2"} series={r.qualDetail.part2.series} total={r.qualDetail.part2.total} />}
                                      {soloFinal?.series && <SeriesLine label={en ? "Match" : "Meč"} series={soloFinal.series} total={r.finalTotal != null ? Math.round(parseFloat(r.finalTotal)) : null} />}
                                    </div>
                                  ) : (
                                    <ResultDetailPanel qualDetail={r.qualDetail} elimDetail={r.elimDetail} elimTotal={r.elimTotal} elimRank={r.elimRank} qualRank={r.qualRank} qualScore={r.qualTotal != null ? fmtQual(r.qualTotal) : null} disciplineCode={r.disciplineCode} locale={locale} finalDetail={r.finalDetail} finalScore={r.finalTotal != null ? fmtFinal(r.finalTotal) : null} finalRank={r.finalRank} hasDecimals={qualDecimals} inners={showInners ? r.qualInners : null} eliminationHref={phaseHref("elim")} qualificationHref={phaseHref("qual")} finalHref={phaseHref("final")} />
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
