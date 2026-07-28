"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import type { QualDetail, PositionsQualDetail } from "@shootermarkt/db/schema";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { displayNoc } from "@shootermarkt/db/noc-list";
import { RemarkBadge, RemarkLegend, assignRemarkCodes, type RemarkLegendItem } from "./RemarkBadge";

const POSITION_LABELS = ["Klečeći", "Ležeći", "Stojeći"] as const;
const POSITION_KEYS = ["kneeling", "prone", "standing"] as const;

// Disciplines whose flat `series` array is really several fixed-size phases
// shot back to back. Shown as labeled groups in the expanded series detail,
// even before any series data has arrived (live results fill values in as
// the match progresses).
type FlatGroup = { label: string; count: number };
const FLAT_GROUPS_BY_DISCIPLINE: Array<{ match: (code: string) => boolean; groups: FlatGroup[] }> = [
  { match: (c) => c.startsWith("R3P"), groups: [
    { label: "Klečeći", count: 2 },
    { label: "Ležeći", count: 2 },
    { label: "Stojeći", count: 2 },
  ] },
  { match: (c) => c === "SPW", groups: [
    { label: "Precizno", count: 3 },
    { label: "Brzo", count: 3 },
  ] },
];

function getFlatGroups(code: string | undefined): FlatGroup[] | null {
  if (!code) return null;
  return FLAT_GROUPS_BY_DISCIPLINE.find((d) => d.match(code))?.groups ?? null;
}

export type CompResultRow = {
  id: number;
  shooterId: number;
  firstName: string;
  lastName: string;
  birthYear: number | null | undefined;
  clubDisplay: string;
  nationality: string | null;
  qualTotal: string | null;
  qualRank: number | null;
  qualInners: number | null;
  qualified: boolean | null;
  qualDetail: QualDetail | null;
  remark: string | null | undefined;
  disciplineCode: string | undefined;
  apparatus: string | null;
};

function QualifiedBadge() {
  return (
    <span
      className="font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)] text-base shrink-0 leading-none"
      style={{ color: "var(--success)" }}
      title="Kvalifikovan za finale"
    >
      Q
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--subtle)]"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 180ms ease" }}
    >
      <path d="M2.5 5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  results: CompResultRow[];
  /** world/olympic/continental (ISSF-level) fields — no clubs, only national teams. */
  competitionLevel?: string;
}

const NOC_ONLY_LEVELS = new Set(["world", "olympic", "continental"]);

// Fixed pixel widths for the (now few) non-flexible columns — a CSS Grid
// track's size is authoritative, unlike a real <table> under table-layout:auto.
const RANK_W = "32px";
const NAME_W = "minmax(96px, 200px)";
const CLUB_W = "minmax(52px, 1fr)";
const TOTAL_W = "92px";
const REMARK_W = "44px";

const headerCellCls = "px-2 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-3 flex items-center bg-[var(--surface-2)] border-b border-[var(--border)]";

// One labeled block of series values inside the expanded detail row, e.g.
// "S1  105 106" or (grouped disciplines) "Klečeći  105 106".
type DetailGroup = { label: string; values: Array<number | null>; bestIdx: number };

function buildDetailGroups(
  r: CompResultRow,
  isPositionsType: boolean,
  flatGroups: FlatGroup[] | null,
  posSeriesCounts: Record<(typeof POSITION_KEYS)[number], number> | null
): DetailGroup[] {
  if (isPositionsType && posSeriesCounts) {
    const posDetail = r.qualDetail as PositionsQualDetail | null;
    return POSITION_KEYS.filter((pos) => posSeriesCounts[pos] > 0).map((pos, pi) => {
      const series = posDetail?.[pos]?.series ?? [];
      const values = Array.from({ length: posSeriesCounts[pos] }).map((_, si) => {
        const shots = series[si];
        return shots ? shots.reduce((a, b) => a + b, 0) : null;
      });
      return { label: POSITION_LABELS[pi], values, bestIdx: -1 };
    });
  }

  const seriesArr = r.qualDetail && "series" in r.qualDetail ? (r.qualDetail as { series: number[] }).series : [];
  const bestIdx = seriesArr.length > 0 ? seriesArr.indexOf(Math.max(...seriesArr)) : -1;

  if (flatGroups) {
    let offset = 0;
    return flatGroups.map((g) => {
      const values = seriesArr.slice(offset, offset + g.count);
      const localBest = bestIdx >= offset && bestIdx < offset + g.count ? bestIdx - offset : -1;
      offset += g.count;
      return { label: g.label, values: values.length > 0 ? values : Array(g.count).fill(null), bestIdx: localBest };
    });
  }

  // Ungrouped flat series — one mini-group per series so the visual language
  // (label above values) stays consistent whether or not the discipline groups.
  return seriesArr.map((v, i) => ({ label: `S${i + 1}`, values: [v], bestIdx: v != null && i === bestIdx ? 0 : -1 }));
}

// Short per-column headers for the desktop inline series columns — one column
// per individual series value (not per group), independent of any single row's
// data so the header stays stable while rows fill in live results.
function buildSeriesHeaders(
  results: CompResultRow[],
  isPositionsType: boolean,
  flatGroups: FlatGroup[] | null,
  posSeriesCounts: Record<(typeof POSITION_KEYS)[number], number> | null
): string[] {
  if (isPositionsType && posSeriesCounts) {
    return POSITION_KEYS.filter((pos) => posSeriesCounts[pos] > 0).flatMap((pos, pi) =>
      Array.from({ length: posSeriesCounts[pos] }, (_, i) => `${POSITION_LABELS[pi][0]}${i + 1}`)
    );
  }
  if (flatGroups) {
    return flatGroups.flatMap((g) => Array.from({ length: g.count }, (_, i) => `${g.label[0]}${i + 1}`));
  }
  const maxLen = Math.max(
    0,
    ...results.map((r) => (r.qualDetail && "series" in r.qualDetail ? (r.qualDetail as { series: number[] }).series.length : 0))
  );
  return Array.from({ length: maxLen }, (_, i) => `S${i + 1}`);
}

function flattenGroups(groups: DetailGroup[]): Array<{ value: number | null; isBest: boolean }> {
  return groups.flatMap((g) => g.values.map((v, i) => ({ value: v, isBest: i === g.bestIdx })));
}

export function CompetitionQualTable({ results, competitionLevel }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Nema rezultata za ovu disciplinu.</p>
      </div>
    );
  }

  const isAirRifle =
    results[0]?.apparatus === "air_rifle" ||
    (results[0]?.disciplineCode?.startsWith("AR") ?? false);
  const hasDecimals = isAirRifle;

  // Detect display type from first result with qualDetail
  const firstWithDetail = results.find((r) => r.qualDetail != null);
  const isPositionsType =
    firstWithDetail?.qualDetail != null && "kneeling" in firstWithDetail.qualDetail;
  const flatGroups = isPositionsType ? null : getFlatGroups(results[0]?.disciplineCode);
  const isSeriesType =
    flatGroups != null || (firstWithDetail?.qualDetail != null && "series" in firstWithDetail.qualDetail);
  const hasSeriesDetail = isPositionsType || isSeriesType;

  const posSeriesCounts = isPositionsType
    ? POSITION_KEYS.reduce((acc, pos) => {
        acc[pos] = Math.max(0, ...results.map((r) => (r.qualDetail as PositionsQualDetail | null)?.[pos]?.series.length ?? 0));
        return acc;
      }, {} as Record<(typeof POSITION_KEYS)[number], number>)
    : null;

  // Inner tens don't apply to air rifle; for other disciplines the column
  // sits to the right of the total, not the left.
  const showInners = !isAirRifle && results.some((r) => r.qualInners != null);
  const clubHeaderLabel = NOC_ONLY_LEVELS.has(competitionLevel ?? "") ? "NOC" : "Klub / NOC";

  const fmt = (v: number) =>
    hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  const sorted = [...results].sort((a, b) => {
    if (a.qualRank == null && b.qualRank == null) return 0;
    if (a.qualRank == null) return 1;
    if (b.qualRank == null) return -1;
    return a.qualRank - b.qualRank;
  });

  const remarkCodes = assignRemarkCodes(sorted.map((r) => r.remark));
  const remarkLegend: RemarkLegendItem[] = sorted
    .map((r, idx) => (remarkCodes[idx] ? { code: remarkCodes[idx]!, remark: r.remark!, label: `${r.lastName} ${r.firstName}` } : null))
    .filter((item): item is RemarkLegendItem => item != null);

  const seriesHeaders = hasSeriesDetail ? buildSeriesHeaders(sorted, isPositionsType, flatGroups, posSeriesCounts) : [];
  const SERIES_COL_W = "60px";
  const gridTemplateColumns = [RANK_W, NAME_W, CLUB_W, ...seriesHeaders.map(() => SERIES_COL_W), TOTAL_W, REMARK_W]
    .filter(Boolean)
    .join(" ");
  const mobileGridTemplateColumns = hasSeriesDetail
    ? "28px minmax(120px, 1fr) minmax(56px, 88px) 72px 30px 14px"
    : "28px minmax(120px, 1fr) minmax(56px, 88px) 72px 34px";

  const allExpanded = hasSeriesDetail && sorted.every((r) => expanded.has(r.id));
  const toggleAll = () => {
    setExpanded(allExpanded ? new Set() : new Set(sorted.map((r) => r.id)));
  };
  const toggleRow = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      {hasSeriesDetail && (
        <div className="flex items-center justify-end px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] sm:hidden">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            {allExpanded ? "Sakrij serije" : "Prikaži sve serije"}
            <ChevronIcon open={allExpanded} />
          </button>
        </div>
      )}
      <div>
        <div
          role="table"
          className="text-sm grid [grid-template-columns:var(--mobile-grid)] sm:[grid-template-columns:var(--desktop-grid)]"
          style={{ "--mobile-grid": mobileGridTemplateColumns, "--desktop-grid": gridTemplateColumns } as CSSProperties}
        >
          {/* Column header row */}
          <div role="row" style={{ display: "contents" }}>
            <div role="columnheader" className={`${headerCellCls} justify-end`}>#</div>
            <div role="columnheader" className={headerCellCls}>Strelac</div>
            <div role="columnheader" className={headerCellCls}>{clubHeaderLabel}</div>
            {hasSeriesDetail && seriesHeaders.map((h, i) => (
              <div key={i} role="columnheader" className={`hidden sm:flex ${headerCellCls} justify-end`}>
                {h}
              </div>
            ))}
            <div role="columnheader" className={`${headerCellCls} justify-end`}>Σ</div>
            <div role="columnheader" className={headerCellCls} aria-hidden="true" />
            {hasSeriesDetail && <div role="columnheader" className={`${headerCellCls} sm:hidden`} aria-hidden="true" />}
          </div>

          {/* Body rows */}
          {sorted.map((r, idx) => {
            const isTopQual = r.qualified === true;
            const isOddRow = idx % 2 === 1;
            const isExpanded = expanded.has(r.id);
            const isLastRow = idx === sorted.length - 1;
            const rowBg = isOddRow ? "var(--surface)" : "var(--bg)";
            const showBottomBorder = !isLastRow || isExpanded;
            const cellCls = `px-2 py-2.5 text-sm sm:px-3 flex items-center transition-colors ${showBottomBorder ? "border-b border-[var(--border)]" : ""}`;
            const seriesFlat = hasSeriesDetail ? flattenGroups(buildDetailGroups(r, isPositionsType, flatGroups, posSeriesCounts)) : [];

            return (
              <div key={r.id} role="rowgroup" style={{ display: "contents" }}>
                <div
                  role="row"
                  className={`group ${hasSeriesDetail ? "cursor-pointer sm:cursor-default" : ""}`}
                  style={{ display: "contents" }}
                  onClick={hasSeriesDetail ? () => toggleRow(r.id) : undefined}
                >
                  {/* Rank */}
                  <div
                    className={`${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums group-hover:bg-[var(--surface-2)]`}
                    style={{ background: rowBg }}
                  >
                    {r.qualRank != null ? (
                      <span className={r.qualRank <= 3 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}>
                        {r.qualRank}
                      </span>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </div>

                  {/* Name — mobile: last name and first name each fixed to their own
                      line, so every row is exactly 2 lines regardless of name length
                      (never lets natural text-wrap decide, which produced 2 or 3
                      lines inconsistently). Desktop has room to run it all inline. */}
                  <div className={`${cellCls} min-w-0 group-hover:bg-[var(--surface-2)]`} style={{ background: rowBg }}>
                    <Link
                      href={`/strelci/${r.shooterId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex min-w-0 flex-col leading-tight py-0.5 group/name sm:flex-row sm:items-baseline sm:gap-1.5"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--ink)] transition-colors group-hover/name:text-[var(--brand-primary)]">
                        {r.lastName}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-[var(--muted)]">
                        <span className="truncate">{r.firstName}</span>
                        {r.birthYear != null && (
                          <span className="shrink-0 text-[0.65rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] tabular-nums">
                            {r.birthYear}
                          </span>
                        )}
                      </span>
                    </Link>
                  </div>

                  {/* Club / NOC */}
                  <div className={`${cellCls} group-hover:bg-[var(--surface-2)]`} style={{ background: rowBg }}>
                    <div className="flex items-center gap-2 min-w-0">
                      {r.nationality && (() => {
                        const noc = displayNoc(r.nationality);
                        const alpha2 = NOC_LIST.find((n) => n.noc === noc)?.alpha2;
                        return (
                          <span className="shrink-0 flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">
                            {alpha2 && (
                              <span
                                className={`fi fi-${alpha2.toLowerCase()}`}
                                style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block", flexShrink: 0 }}
                              />
                            )}
                            {noc}
                          </span>
                        );
                      })()}
                      {r.clubDisplay && (
                        <span className="text-[var(--muted)] text-xs truncate">
                          {r.clubDisplay}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Series values — desktop only; row fits every series in-line so no expand is needed */}
                  {hasSeriesDetail && seriesHeaders.map((_, i) => {
                    const item = seriesFlat[i];
                    return (
                      <div
                        key={i}
                        className={`hidden sm:flex ${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] text-xs sm:text-sm tabular-nums group-hover:bg-[var(--surface-2)]`}
                        style={{ background: rowBg }}
                      >
                        {item?.value != null ? (
                          <span className={item.isBest ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>
                            {fmt(item.value)}
                          </span>
                        ) : (
                          <span className="text-[var(--subtle)]">—</span>
                        )}
                      </div>
                    );
                  })}

                  {/* Total — inner tens shown inline, right after the number */}
                  <div
                    className={`${cellCls} justify-end gap-1.5 font-[family-name:var(--font-jetbrains-mono)] font-bold text-base tabular-nums text-[var(--ink)] group-hover:bg-[var(--surface-2)]`}
                    style={{ background: rowBg }}
                  >
                    {r.qualTotal != null
                      ? fmt(parseFloat(r.qualTotal))
                      : <span className="font-normal text-[var(--subtle)]">—</span>}
                    {showInners && r.qualInners != null && (
                      <span className="text-xs font-normal text-[var(--muted)]">
                        {r.qualInners}<span className="text-[0.6rem]">×</span>
                      </span>
                    )}
                  </div>

                  {/* Remark / Q badge — own narrow column, not inline with the total */}
                  <div className={`${cellCls} justify-center group-hover:bg-[var(--surface-2)]`} style={{ background: rowBg }}>
                    {r.remark ? (
                      <RemarkBadge remark={r.remark} code={remarkCodes[idx]} label={`${r.lastName} ${r.firstName}`} className="" />
                    ) : isTopQual ? (
                      <QualifiedBadge />
                    ) : null}
                  </div>

                  {/* Expand chevron — mobile only, rightmost column; desktop shows series inline instead */}
                  {hasSeriesDetail && (
                    <div className={`${cellCls} !px-0.5 justify-center group-hover:bg-[var(--surface-2)] sm:hidden`} style={{ background: rowBg }}>
                      <ChevronIcon open={isExpanded} />
                    </div>
                  )}
                </div>

                {/* Expanded series detail — mobile only; desktop shows series inline in the row */}
                <AnimatePresence initial={false}>
                  {hasSeriesDetail && isExpanded && (
                    <motion.div
                      key={`series-${r.id}`}
                      role="row"
                      initial={reducedMotion ? false : { height: 0, opacity: 0, y: -4 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { height: 0, opacity: 0, transition: { duration: 0.18 } }}
                      transition={{ duration: reducedMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                      style={{ gridColumn: "1 / -1", background: rowBg }}
                      className={`min-h-0 px-3 overflow-hidden sm:hidden ${isLastRow ? "" : "border-b border-[var(--border)]"}`}
                    >
                      {isPositionsType || flatGroups ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 py-2">
                          {buildDetailGroups(r, isPositionsType, flatGroups, posSeriesCounts).map((g, gi) => (
                            <div key={gi} className="flex flex-col gap-0.5">
                              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">
                                {g.label}
                              </span>
                              <div className="flex gap-2 font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums">
                                {g.values.map((v, vi) => (
                                  <span
                                    key={vi}
                                    className={vi === g.bestIdx ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}
                                  >
                                    {v != null ? fmt(v) : "—"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 py-2 font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums">
                          {seriesFlat.map((item, i) => (
                            <span
                              key={i}
                              className={item.isBest ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}
                            >
                              {item.value != null ? fmt(item.value) : "—"}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
      <RemarkLegend items={remarkLegend} />
    </div>
  );
}
