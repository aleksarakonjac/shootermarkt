import { Link } from "@/i18n/navigation";
import type { FinalDetail } from "@/lib/db/schema";
import { NOC_LIST } from "@/components/ui/NocDropdown";

export type FinalResultRow = {
  id: number;
  shooterId: number;
  name: string;
  birthYear: number | null;
  clubDisplay: string;
  nationality: string | null;
  finalTotal: string | null;
  finalRank: number | null;
  finalDetail: FinalDetail | null;
};

interface Props {
  results: FinalResultRow[];
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
// <table>) is required for sticky columns to actually stick.
const RANK_W = "48px";
const NAME_W = "minmax(150px, 1fr)";
const CLUB_W = "minmax(90px, 150px)";
const SERIES_W = "60px";
const TOTAL_W = "96px";

const headerCellCls = "px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center bg-[var(--surface)] border-b border-[var(--border)]";

export function CompetitionFinalTable({ results }: Props) {
  const sorted = [...results]
    .filter((r) => r.finalRank != null || r.finalTotal != null)
    .sort((a, b) => {
      if (a.finalRank == null && b.finalRank == null) return 0;
      if (a.finalRank == null) return 1;
      if (b.finalRank == null) return -1;
      return a.finalRank - b.finalRank;
    });

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Nema finalnih rezultata.</p>
      </div>
    );
  }

  const isHitCountFinal = sorted.some((result) => result.finalDetail?.format === "bulletin" && result.finalDetail.scoring === "hit_count");
  const columns = buildColumns(sorted);

  const gridTemplateColumns = [RANK_W, NAME_W, CLUB_W, `repeat(${columns.length}, ${SERIES_W})`, TOTAL_W].join(" ");
  const totalCols = 3 + columns.length + 1;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <div role="table" className="text-sm grid" style={{ gridTemplateColumns, minWidth: `${totalCols * 56 + 60}px` }}>
          <div role="row" style={{ display: "contents" }}>
            <div role="columnheader" className={`${headerCellCls} justify-center`}>#</div>
            <div role="columnheader" className={headerCellCls}>Strelac</div>
            <div role="columnheader" className={headerCellCls}>Klub / NOC</div>
            {columns.map((col, i) => (
              <div key={i} role="columnheader" className={`${headerCellCls} justify-end`}>
                {col.header}
              </div>
            ))}
            <div
              role="columnheader"
              className="sticky flex items-center justify-end px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink)] border-b border-[var(--border)]"
              style={{ right: 0, background: "var(--surface)", zIndex: 1 }}
            >
              {isHitCountFinal ? "Pogoci" : "Final Σ"}
            </div>
          </div>

          {sorted.map((r, idx) => {
            const isLast = idx === sorted.length - 1;
            const cellCls = `px-3 py-2.5 text-sm flex items-center hover:bg-[var(--surface-2)] transition-colors ${isLast ? "" : "border-b border-[var(--border)]"}`;
            return (
              <div key={r.id} role="row" style={{ display: "contents" }}>
                {/* Rank */}
                <div className={`${cellCls} justify-center font-[family-name:var(--font-jetbrains-mono)] tabular-nums`}>
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

                {/* Name */}
                <div className={cellCls}>
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/strelci/${r.shooterId}`}
                      className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors"
                    >
                      {r.name}
                    </Link>
                    {r.birthYear != null && (
                      <span className="text-[0.65rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] tabular-nums translate-y-px">
                        {r.birthYear}
                      </span>
                    )}
                  </span>
                </div>

                {/* Club / NOC */}
                <div className={cellCls}>
                  <div className="flex items-center gap-2 min-w-0">
                    {r.nationality && (() => {
                      const alpha2 = NOC_LIST.find((n) => n.noc === r.nationality)?.alpha2;
                      return (
                        <span className="shrink-0 flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">
                          {alpha2 && (
                            <span
                              className={`fi fi-${alpha2.toLowerCase()}`}
                              style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block", flexShrink: 0 }}
                            />
                          )}
                          {r.nationality}
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

                {/* Series columns */}
                {columns.map((col, i) => {
                  const val = col.getValue(r);
                  return (
                    <div key={i} className={`${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums text-[var(--muted)]`}>
                      {val != null ? col.fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                    </div>
                  );
                })}

                {/* Final total — pinned right on mobile so it stays visible while scrolling series columns */}
                <div
                  className={`sticky flex items-center justify-end px-4 py-2.5 font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm tabular-nums text-[var(--ink)] ${isLast ? "" : "border-b border-[var(--border)]"}`}
                  style={{ right: 0, background: "var(--bg)", zIndex: 1 }}
                >
                  {r.finalTotal ?? (
                    <span className="font-normal text-[var(--subtle)]">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
