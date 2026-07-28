"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import type { FinalDetail } from "@shootermarkt/db/schema";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { displayNoc } from "@shootermarkt/db/noc-list";
import { RemarkBadge, RemarkLegend, assignRemarkCodes, type RemarkLegendItem } from "./RemarkBadge";

export type FinalResultRow = {
  id: number;
  shooterId: number;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  avatarUrl: string | null;
  clubDisplay: string;
  nationality: string | null;
  finalTotal: string | null;
  finalRank: number | null;
  finalDetail: FinalDetail | null;
  remark: string | null | undefined;
};

function Avatar({ firstName, lastName, avatarUrl }: { firstName: string; lastName: string; avatarUrl: string | null }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  if (avatarUrl) {
    return (
      <div className="relative shrink-0 w-7 h-7 rounded-full ring-1 ring-[var(--border)] overflow-hidden">
        <Image src={avatarUrl} alt="" fill sizes="28px" className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className="shrink-0 w-7 h-7 rounded-full ring-1 ring-[var(--border)] flex items-center justify-center bg-[var(--surface-2)]"
      aria-hidden="true"
    >
      <span className="text-[0.6rem] font-bold text-[var(--muted)]">{initials}</span>
    </div>
  );
}

interface Props {
  results: FinalResultRow[];
  /** world/olympic/continental (ISSF-level) fields — no clubs, only national teams. */
  competitionLevel?: string;
}

const MEDAL_COLOR: Record<number, string> = {
  1: "oklch(0.75 0.14 85)",
  2: "oklch(0.75 0.01 85)",
  3: "oklch(0.60 0.10 55)",
};

function MedalIcon({ rank }: { rank: number }) {
  const color = MEDAL_COLOR[rank];
  if (!color) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.65rem] font-bold text-white shrink-0"
      style={{ background: color }}
      aria-label={`Mesto ${rank}`}
    >
      {rank}
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

type Column = { header: string; getValue: (r: FinalResultRow) => number | null; fmt: (v: number) => string };

const decimalFmt = (v: number) => v.toFixed(1);
const intFmt = (v: number) => Math.round(v).toString();

function buildColumns(rows: FinalResultRow[]): Column[] {
  const withDetail = rows.find((r) => r.finalDetail);
  const format = withDetail?.finalDetail?.format;
  if (!format) return [];

  if (format === "ar_ap_10m") {
    const maxPhase2 = Math.max(0, ...rows.map((r) => (r.finalDetail?.format === "ar_ap_10m" ? r.finalDetail.phase2.shots.length : 0)));
    const cols: Column[] = [0, 1].map((si) => ({
      header: `S${si + 1}`,
      fmt: decimalFmt,
      getValue: (r) => (r.finalDetail?.format === "ar_ap_10m" ? r.finalDetail.phase1.series[si]?.reduce((a, b) => a + b, 0) ?? null : null),
    }));
    for (let i = 0; i < maxPhase2; i++) {
      cols.push({
        header: `F${i + 1}`,
        fmt: decimalFmt,
        getValue: (r) => (r.finalDetail?.format === "ar_ap_10m" ? r.finalDetail.phase2.shots[i] ?? null : null),
      });
    }
    return cols;
  }

  if (format === "3x20_mk" || format === "3x40_mk") {
    const maxPhase2 = Math.max(0, ...rows.map((r) => (r.finalDetail && "phase2" in r.finalDetail ? r.finalDetail.phase2.shots.length : 0)));
    const cols: Column[] = (["kneeling", "prone", "standing"] as const).map((pos, i) => ({
      header: ["Klečeći", "Ležeći", "Stojeći"][i],
      fmt: withDetail?.finalDetail?.format === "3x40_mk" ? decimalFmt : intFmt,
      getValue: (r) => (r.finalDetail && (r.finalDetail.format === "3x20_mk" || r.finalDetail.format === "3x40_mk") ? r.finalDetail.phase1[pos].total : null),
    }));
    for (let i = 0; i < maxPhase2; i++) {
      cols.push({
        header: `F${i + 1}`,
        fmt: withDetail?.finalDetail?.format === "3x40_mk" ? decimalFmt : intFmt,
        getValue: (r) => (r.finalDetail && (r.finalDetail.format === "3x20_mk" || r.finalDetail.format === "3x40_mk") ? r.finalDetail.phase2.shots[i] ?? null : null),
      });
    }
    return cols;
  }

  // bulletin: pick whichever array is populated (shots > series > cumulative)
  const kind: "shots" | "series" | "cumulative" | null = rows.some((r) => r.finalDetail?.format === "bulletin" && r.finalDetail.shots?.length)
    ? "shots"
    : rows.some((r) => r.finalDetail?.format === "bulletin" && r.finalDetail.series?.length)
      ? "series"
      : rows.some((r) => r.finalDetail?.format === "bulletin" && r.finalDetail.cumulative?.length)
        ? "cumulative"
        : null;
  if (!kind) return [];

  const isHitCount = withDetail?.finalDetail?.format === "bulletin" && withDetail.finalDetail.scoring === "hit_count";
  const fmt = isHitCount ? intFmt : decimalFmt;
  const maxLen = Math.max(0, ...rows.map((r) => (r.finalDetail?.format === "bulletin" ? r.finalDetail[kind]?.length ?? 0 : 0)));
  const labelPrefix = kind === "shots" ? "H" : kind === "series" ? "S" : "F";
  const cols: Column[] = [];
  for (let i = 0; i < maxLen; i++) {
    cols.push({
      header: (withDetail?.finalDetail?.format === "bulletin" ? withDetail.finalDetail.seriesLabels?.[i] : undefined) ?? `${labelPrefix}${i + 1}`,
      fmt,
      getValue: (r) => (r.finalDetail?.format === "bulletin" ? r.finalDetail[kind]?.[i] ?? null : null),
    });
  }
  return cols;
}

// Fixed pixel widths — see CompetitionQualTable for why CSS Grid (not a real
// <table>) is required.
const RANK_W = "40px";
const AVATAR_W = "40px";
const NAME_W = "minmax(140px, 220px)";
const CLUB_W = "minmax(80px, 1fr)";
const TOTAL_W = "76px";
const REMARK_W = "24px";

const NOC_ONLY_LEVELS = new Set(["world", "olympic", "continental"]);

const headerCellCls = "px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center bg-[var(--surface)] border-b border-[var(--border)]";
const narrowHeaderCellCls = "px-1 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center bg-[var(--surface)] border-b border-[var(--border)]";

export function CompetitionFinalTable({ results, competitionLevel }: Props) {
  const clubHeaderLabel = NOC_ONLY_LEVELS.has(competitionLevel ?? "") ? "NOC" : "Klub / NOC";
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();

  const sorted = [...results]
    .filter((r) => r.finalRank != null || r.finalTotal != null)
    .sort((a, b) => {
      if (a.finalRank == null && b.finalRank == null) return 0;
      if (a.finalRank == null) return 1;
      if (b.finalRank == null) return -1;
      return a.finalRank - b.finalRank;
    });

  const remarkCodes = assignRemarkCodes(sorted.map((r) => r.remark));
  const remarkLegend: RemarkLegendItem[] = sorted
    .map((r, idx) => (remarkCodes[idx] ? { code: remarkCodes[idx]!, remark: r.remark!, label: `${r.lastName} ${r.firstName}` } : null))
    .filter((item): item is RemarkLegendItem => item != null);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Nema finalnih rezultata.</p>
      </div>
    );
  }

  const isHitCountFinal = sorted.some((result) => result.finalDetail?.format === "bulletin" && result.finalDetail.scoring === "hit_count");
  const columns = buildColumns(sorted);
  const hasDetail = columns.length > 0;

  const SERIES_COL_W = "56px";
  const gridTemplateColumns = [RANK_W, AVATAR_W, NAME_W, CLUB_W, ...columns.map(() => SERIES_COL_W), TOTAL_W, REMARK_W]
    .filter(Boolean)
    .join(" ");
  const mobileGridTemplateColumns = hasDetail
    ? "32px 36px minmax(110px, 1fr) minmax(48px, 80px) 64px 14px 18px"
    : "32px 36px minmax(110px, 1fr) minmax(48px, 80px) 64px 14px";

  const allExpanded = hasDetail && sorted.every((r) => expanded.has(r.id));
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
      {hasDetail && (
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
          <div role="row" style={{ display: "contents" }}>
            <div role="columnheader" className={`${headerCellCls} justify-center`}>#</div>
            <div role="columnheader" className={headerCellCls} aria-hidden="true" />
            <div role="columnheader" className={headerCellCls}>Strelac</div>
            <div role="columnheader" className={headerCellCls}>{clubHeaderLabel}</div>
            {hasDetail && <div role="columnheader" className={`${narrowHeaderCellCls} sm:hidden`} aria-hidden="true" />}
            {hasDetail && columns.map((col, i) => (
              <div key={i} role="columnheader" className={`hidden sm:flex ${headerCellCls} justify-end`}>
                {col.header}
              </div>
            ))}
            <div role="columnheader" className={`${headerCellCls} justify-end whitespace-nowrap`}>
              {isHitCountFinal ? "Pogoci" : "Σ"}
            </div>
            <div role="columnheader" className={narrowHeaderCellCls} aria-hidden="true" />
          </div>

          {sorted.map((r, idx) => {
            const isExpanded = expanded.has(r.id);
            const isLastRow = idx === sorted.length - 1;
            const showBottomBorder = !isLastRow || isExpanded;
            const cellCls = `px-3 py-2.5 text-sm flex items-center transition-colors ${showBottomBorder ? "border-b border-[var(--border)]" : ""}`;
            const narrowCellCls = `px-1 py-2.5 text-sm flex items-center transition-colors ${showBottomBorder ? "border-b border-[var(--border)]" : ""}`;
            return (
              <div key={r.id} role="rowgroup" style={{ display: "contents" }}>
                <div
                  role="row"
                  className={`group ${hasDetail ? "cursor-pointer sm:cursor-default" : ""}`}
                  style={{ display: "contents" }}
                  onClick={hasDetail ? () => toggleRow(r.id) : undefined}
                >
                  {/* Rank */}
                  <div className={`${cellCls} justify-center font-[family-name:var(--font-jetbrains-mono)] tabular-nums group-hover:bg-[var(--surface-2)]`}>
                    {r.finalRank != null ? (
                      MEDAL_COLOR[r.finalRank] ? (
                        <MedalIcon rank={r.finalRank} />
                      ) : (
                        <span className="text-[var(--muted)]">{r.finalRank}</span>
                      )
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className={`${narrowCellCls} justify-center group-hover:bg-[var(--surface-2)]`}>
                    <Avatar firstName={r.firstName} lastName={r.lastName} avatarUrl={r.avatarUrl} />
                  </div>

                  {/* Name — mobile: last name and first name each fixed to their own
                      line, so every row is exactly 2 lines regardless of name length.
                      Desktop has room to run it all inline. */}
                  <div className={`${cellCls} min-w-0 group-hover:bg-[var(--surface-2)]`}>
                    <Link
                      href={`/strelci/${r.shooterId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-1.5 leading-tight py-0.5 group/name"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--ink)] group-hover/name:text-[var(--brand-primary)] transition-colors">
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
                  <div className={`${cellCls} min-w-0 group-hover:bg-[var(--surface-2)]`}>
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

                  {/* Series values — desktop only; row fits every series in-line so no expand is needed.
                      Cumulative running total stacked above each series value, widening the row. */}
                  {hasDetail && (() => {
                    let running = 0;
                    let sawNull = false;
                    return columns.map((col, i) => {
                      const val = col.getValue(r);
                      if (val == null) sawNull = true;
                      else running += val;
                      return (
                        <div
                          key={i}
                          className={`hidden sm:flex ${cellCls} flex-col items-end justify-center gap-0.5 group-hover:bg-[var(--surface-2)]`}
                        >
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--subtle)]">
                            {sawNull ? "" : col.fmt(running)}
                          </span>
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)]">
                            {val != null ? col.fmt(val) : ""}
                          </span>
                        </div>
                      );
                    });
                  })()}

                  {/* Final total */}
                  <div className={`${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm tabular-nums text-[var(--ink)] group-hover:bg-[var(--surface-2)]`}>
                    {r.finalTotal ?? (
                      <span className="font-normal text-[var(--subtle)]">—</span>
                    )}
                  </div>

                  {/* Remark — e.g. SO (shoot-off decided who's out of the final) */}
                  <div className={`${narrowCellCls} justify-center group-hover:bg-[var(--surface-2)]`}>
                    {r.remark && <RemarkBadge remark={r.remark} code={remarkCodes[idx]} label={`${r.lastName} ${r.firstName}`} className="" />}
                  </div>

                  {/* Expand chevron — mobile only, rightmost column; desktop shows series inline instead */}
                  {hasDetail && (
                    <div className={`${narrowCellCls} justify-center group-hover:bg-[var(--surface-2)] sm:hidden`}>
                      <ChevronIcon open={isExpanded} />
                    </div>
                  )}
                </div>

                {/* Expanded series detail — mobile only; desktop shows series inline in the row */}
                <AnimatePresence initial={false}>
                  {hasDetail && isExpanded && (
                    <motion.div
                      key={`series-${r.id}`}
                      role="row"
                      initial={reducedMotion ? false : { height: 0, opacity: 0, y: -4 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { height: 0, opacity: 0, transition: { duration: 0.18 } }}
                      transition={{ duration: reducedMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                      style={{ gridColumn: "1 / -1" }}
                      className={`min-h-0 px-3 overflow-hidden sm:hidden ${isLastRow ? "" : "border-b border-[var(--border)]"}`}
                    >
                      <div className="grid grid-flow-col auto-cols-fr gap-x-1 pt-2">
                        {(() => {
                          let running = 0;
                          let sawNull = false;
                          return columns.map((col, i) => {
                            const val = col.getValue(r);
                            if (val == null) sawNull = true;
                            else running += val;
                            return (
                              <span
                                key={i}
                                className="min-w-0 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--subtle)]"
                              >
                                {sawNull ? "" : col.fmt(running)}
                              </span>
                            );
                          });
                        })()}
                      </div>
                      <div className="grid grid-flow-col auto-cols-fr gap-x-1 pb-2">
                        {columns.map((col, i) => {
                          const val = col.getValue(r);
                          return (
                            <span
                              key={i}
                              className="min-w-0 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)]"
                            >
                              {val != null ? col.fmt(val) : ""}
                            </span>
                          );
                        })}
                      </div>
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
