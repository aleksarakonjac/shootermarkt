import { Link } from "@/i18n/navigation";
import type { QualDetail, PositionsQualDetail } from "@/lib/db/schema";
import { NOC_LIST } from "@/components/ui/NocDropdown";

const POSITION_LABELS = ["Klečeći", "Ležeći", "Stojeći"] as const;
const POSITION_KEYS = ["kneeling", "prone", "standing"] as const;

// Disciplines whose flat `series` array is really several fixed-size phases
// shot back to back. Group header + column count are always shown for these,
// even before any series data has arrived (live results fill columns in as
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
  name: string;
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

// Boja po značenju kazne/napomene — bez box-a, samo obojeno slovo/oznaka.
// DSQ i A-kaznene oznake (A1, A2...) su diskvalifikacije → crveno (--danger).
// RPO nije kazna niti neuspeh — strelac je punopravno odshootao, samo ne može
// u finale zbog nacionalne kvote (max 3/nacija) → posebna (amber) boja, da se
// razlikuje i od diskvalifikacije i od DNS/DNF (koji nemaju rezultat uopšte).
// --warning token je presvetao za tekst (2.5:1 na belom) pa koristimo tamniju
// nijansu istog hue-a koja prolazi AA kontrast.
const RPO_COLOR = "oklch(0.55 0.16 75)";

function remarkColor(remark: string): string {
  if (remark === "DSQ" || /^A\d/.test(remark)) return "var(--danger)";
  if (remark === "RPO") return RPO_COLOR;
  return "var(--muted)";
}

function RemarkBadge({ remark, className = "ml-1.5" }: { remark: string; className?: string }) {
  return (
    <span
      className={`font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)] text-base shrink-0 leading-none ${className}`}
      style={{ color: remarkColor(remark) }}
      title={remark}
    >
      {remark}
    </span>
  );
}

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

interface Props {
  results: CompResultRow[];
}

// Fixed pixel widths for every non-flexible column. Sticky offsets are plain
// constants against these — no DOM measuring needed, because (unlike a real
// <table>, where table-layout:auto can silently override a column's width
// and where position:sticky on a table-cell is unreliable in Chromium) a
// CSS Grid track's size is authoritative and its items support sticky cleanly.
const RANK_W = "44px";
const NAME_W = "minmax(150px, 1fr)";
const CLUB_W = "minmax(90px, 150px)";
const SERIES_W = "56px";
const INNERS_W = "44px";
const TOTAL_W = "76px";
const REMARK_W = "60px";

const headerCellCls = "px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center bg-[var(--surface-2)]";
const groupHeaderCellCls = "px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--subtle)] flex items-center justify-center bg-[var(--surface-2)]";

export function CompetitionQualTable({ results }: Props) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Nema rezultata za ovu disciplinu.</p>
      </div>
    );
  }

  const hasDecimals =
    results[0]?.apparatus === "air_rifle" ||
    (results[0]?.disciplineCode?.startsWith("AR") ?? false);

  // Detect display type from first result with qualDetail
  const firstWithDetail = results.find((r) => r.qualDetail != null);
  const isPositionsType =
    firstWithDetail?.qualDetail != null && "kneeling" in firstWithDetail.qualDetail;
  // R3P/SPW-style disciplines are always fixed groups of series (3×2 or 2×3),
  // shown from the start regardless of how many series have actually come in
  // yet — live results fill columns in as the match progresses, so the full
  // grid (with empty cells) must render up front.
  const flatGroups = isPositionsType ? null : getFlatGroups(results[0]?.disciplineCode);
  const isFlatGrouped = flatGroups != null;
  const isSeriesType =
    isFlatGrouped || (firstWithDetail?.qualDetail != null && "series" in firstWithDetail.qualDetail);
  const seriesCount = isFlatGrouped
    ? flatGroups.reduce((sum, g) => sum + g.count, 0)
    : isSeriesType
      ? (firstWithDetail!.qualDetail as { series: number[] }).series.length
      : 0;
  // Column indices (0-based) where a new group starts, for the border-left divider
  const groupBoundaries = new Set<number>();
  if (flatGroups) {
    let acc = 0;
    for (const g of flatGroups.slice(0, -1)) {
      acc += g.count;
      groupBoundaries.add(acc);
    }
  }

  // Per-position sub-series column counts (may differ, e.g. standing split into 2 series)
  const posSeriesCounts = isPositionsType
    ? POSITION_KEYS.reduce((acc, pos) => {
        acc[pos] = Math.max(0, ...results.map((r) => (r.qualDetail as PositionsQualDetail | null)?.[pos]?.series.length ?? 0));
        return acc;
      }, {} as Record<(typeof POSITION_KEYS)[number], number>)
    : null;
  const posSeriesTotal = posSeriesCounts
    ? posSeriesCounts.kneeling + posSeriesCounts.prone + posSeriesCounts.standing
    : 0;

  const showGroupHeader = isPositionsType || isFlatGrouped;

  // Show inners column if any row has inners data
  const showInners = results.some((r) => r.qualInners != null);

  const fmt = (v: number) =>
    hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  const sorted = [...results].sort((a, b) => {
    if (a.qualRank == null && b.qualRank == null) return 0;
    if (a.qualRank == null) return 1;
    if (b.qualRank == null) return -1;
    return a.qualRank - b.qualRank;
  });

  const seriesTracks = isPositionsType
    ? `repeat(${posSeriesTotal}, ${SERIES_W})`
    : isSeriesType
      ? `repeat(${seriesCount}, ${SERIES_W})`
      : "";
  const gridTemplateColumns = [RANK_W, NAME_W, CLUB_W, seriesTracks, showInners ? INNERS_W : "", TOTAL_W, REMARK_W]
    .filter(Boolean)
    .join(" ");
  const totalCols = 3 + (isPositionsType ? posSeriesTotal : seriesCount) + (showInners ? 1 : 0) + 2;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <div role="table" className="text-sm grid" style={{ gridTemplateColumns, minWidth: `${totalCols * 56 + 90}px` }}>
          {/* Stance/phase group header (R3P, SPW precizno+brzo) */}
          {showGroupHeader && (
            <div role="row" style={{ display: "contents" }}>
              <div style={{ gridColumn: "span 3" }} className="bg-[var(--surface-2)]" aria-hidden="true" />
              {isPositionsType &&
                POSITION_KEYS.map((pos, pi) => (
                  <div
                    key={pos}
                    role="columnheader"
                    style={{ gridColumn: `span ${posSeriesCounts![pos]}` }}
                    className={`${groupHeaderCellCls} ${pi > 0 ? "border-l border-[var(--border)]" : ""}`}
                  >
                    {POSITION_LABELS[pi]}
                  </div>
                ))}
              {isFlatGrouped &&
                flatGroups!.map((g, gi) => (
                  <div
                    key={gi}
                    role="columnheader"
                    style={{ gridColumn: `span ${g.count}` }}
                    className={`${groupHeaderCellCls} ${gi > 0 ? "border-l border-[var(--border)]" : ""}`}
                  >
                    {g.label}
                  </div>
                ))}
              <div style={{ gridColumn: `span ${showInners ? 3 : 2}` }} className="bg-[var(--surface-2)]" aria-hidden="true" />
            </div>
          )}

          {/* Column header row */}
          <div role="row" style={{ display: "contents" }}>
            <div role="columnheader" className={`${headerCellCls} justify-end border-b border-[var(--border)]`}>#</div>
            <div role="columnheader" className={`${headerCellCls} border-b border-[var(--border)]`}>Strelac</div>
            <div role="columnheader" className={`${headerCellCls} border-b border-[var(--border)]`}>Klub / NOC</div>

            {isSeriesType &&
              Array.from({ length: seriesCount }).map((_, i) => (
                <div
                  key={i}
                  role="columnheader"
                  className={`${headerCellCls} justify-end border-b border-[var(--border)] ${groupBoundaries.has(i) ? "border-l" : ""}`}
                >
                  S{i + 1}
                </div>
              ))}

            {isPositionsType &&
              posSeriesCounts &&
              POSITION_KEYS.flatMap((pos, pi) =>
                Array.from({ length: posSeriesCounts[pos] }).map((_, si) => (
                  <div
                    key={`${pos}-${si}`}
                    role="columnheader"
                    className={`${headerCellCls} justify-end border-b border-[var(--border)] ${si === 0 && pi > 0 ? "border-l" : ""}`}
                  >
                    S{si + 1}
                  </div>
                ))
              )}

            {showInners && (
              <div role="columnheader" className={`${headerCellCls} justify-end border-b border-[var(--border)]`}>×</div>
            )}

            <div
              role="columnheader"
              className="sticky flex items-center justify-end px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink)] border-b border-[var(--border)]"
              style={{ right: REMARK_W, background: "var(--surface-2)", zIndex: 1 }}
            >
              Σ
            </div>
            <div
              role="columnheader"
              className="sticky flex items-center justify-center px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]"
              style={{ right: 0, background: "var(--surface-2)", zIndex: 1 }}
            >
              Nap.
            </div>
          </div>

          {/* Body rows */}
          {sorted.map((r, idx) => {
            const seriesArr =
              isSeriesType && r.qualDetail
                ? (r.qualDetail as { series: number[] }).series
                : null;
            const posDetail =
              isPositionsType && r.qualDetail
                ? (r.qualDetail as PositionsQualDetail)
                : null;

            const bestSeriesIdx =
              seriesArr != null
                ? seriesArr.indexOf(Math.max(...seriesArr))
                : -1;

            const isTopQual = r.qualified === true;
            const isOddRow = idx % 2 === 1;
            const isLast = idx === sorted.length - 1;
            const rowBg = isOddRow ? "var(--surface)" : "var(--bg)";
            const cellCls = `px-3 py-2.5 text-sm flex items-center group-hover:bg-[var(--surface-2)] transition-colors ${isLast ? "" : "border-b border-[var(--border)]"}`;

            return (
              <div key={r.id} role="row" className="group" style={{ display: "contents" }}>
                {/* Rank */}
                <div className={`${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums`} style={{ background: rowBg }}>
                  {r.qualRank != null ? (
                    <span className={r.qualRank <= 3 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}>
                      {r.qualRank}
                    </span>
                  ) : (
                    <span className="text-[var(--subtle)]">—</span>
                  )}
                </div>

                {/* Name */}
                <div className={cellCls} style={{ background: rowBg }}>
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
                <div className={cellCls} style={{ background: rowBg }}>
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

                {/* Series values */}
                {isSeriesType &&
                  Array.from({ length: seriesCount }).map((_, i) => {
                    const val = seriesArr?.[i];
                    const isBest = i === bestSeriesIdx && val != null;
                    return (
                      <div
                        key={i}
                        className={`${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums ${
                          isBest ? "text-[var(--ink)] font-semibold" : "text-[var(--muted)]"
                        } ${groupBoundaries.has(i) ? "border-l" : ""}`}
                        style={{ background: rowBg }}
                      >
                        {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                      </div>
                    );
                  })}

                {/* Position sub-series values */}
                {isPositionsType &&
                  posSeriesCounts &&
                  POSITION_KEYS.flatMap((pos, pi) => {
                    const posData = posDetail?.[pos];
                    return Array.from({ length: posSeriesCounts[pos] }).map((_, si) => {
                      const shots = posData?.series[si];
                      const val = shots ? shots.reduce((a, b) => a + b, 0) : null;
                      return (
                        <div
                          key={`${pos}-${si}`}
                          className={`${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums text-[var(--muted)] ${si === 0 && pi > 0 ? "border-l" : ""}`}
                          style={{ background: rowBg }}
                        >
                          {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                        </div>
                      );
                    });
                  })}

                {/* Inners */}
                {showInners && (
                  <div className={`${cellCls} justify-end font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]`} style={{ background: rowBg }}>
                    {r.qualInners != null ? (
                      <>{r.qualInners}<span className="text-[0.6rem]">×</span></>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </div>
                )}

                {/* Total — pinned right on mobile so it stays visible while scrolling series columns */}
                <div
                  className={`sticky flex items-center justify-end px-4 py-2.5 font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm tabular-nums text-[var(--ink)] ${isLast ? "" : "border-b border-[var(--border)]"}`}
                  style={{ right: REMARK_W, background: rowBg, zIndex: 1 }}
                >
                  {r.qualTotal != null
                    ? fmt(parseFloat(r.qualTotal))
                    : <span className="font-normal text-[var(--subtle)]">—</span>}
                </div>

                {/* Remarks: DSQ/DNS/DNF/SO/RPO from result, or Q for top-8 finalists — pinned right */}
                <div
                  className={`sticky flex items-center justify-center px-3 py-2.5 ${isLast ? "" : "border-b border-[var(--border)]"}`}
                  style={{ right: 0, background: rowBg, zIndex: 1 }}
                >
                  {r.remark ? (
                    <RemarkBadge remark={r.remark} className="" />
                  ) : isTopQual ? (
                    <QualifiedBadge />
                  ) : (
                    <span className="text-[var(--subtle)] text-xs">—</span>
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
