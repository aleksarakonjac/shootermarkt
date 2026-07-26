import { Link } from "@/i18n/navigation";
import type { QualDetail, PositionsQualDetail } from "@/lib/db/schema";
import { NOC_LIST } from "@/components/ui/NocDropdown";

const POSITION_LABELS = ["Klečeći", "Ležeći", "Stojeći"] as const;
const POSITION_KEYS = ["kneeling", "prone", "standing"] as const;

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

const REMARK_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  RPO: {
    bg:     "color-mix(in oklch, oklch(0.75 0.16 75) 15%, transparent)",
    color:  "oklch(0.52 0.16 75)",
    border: "color-mix(in oklch, oklch(0.75 0.16 75) 30%, transparent)",
  },
  DSQ: {
    bg:     "color-mix(in oklch, oklch(0.62 0.22 25) 12%, transparent)",
    color:  "oklch(0.48 0.22 25)",
    border: "color-mix(in oklch, oklch(0.62 0.22 25) 25%, transparent)",
  },
  DNS: {
    bg:     "color-mix(in oklch, var(--muted) 10%, transparent)",
    color:  "var(--muted)",
    border: "color-mix(in oklch, var(--muted) 20%, transparent)",
  },
  DNF: {
    bg:     "color-mix(in oklch, var(--muted) 10%, transparent)",
    color:  "var(--muted)",
    border: "color-mix(in oklch, var(--muted) 20%, transparent)",
  },
  SO: {
    bg:     "color-mix(in oklch, oklch(0.60 0.18 240) 12%, transparent)",
    color:  "oklch(0.48 0.18 240)",
    border: "color-mix(in oklch, oklch(0.60 0.18 240) 25%, transparent)",
  },
};

function RemarkBadge({ remark, className = "ml-1.5" }: { remark: string; className?: string }) {
  const style = REMARK_STYLE[remark] ?? REMARK_STYLE.DNS;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.58rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)] shrink-0 leading-none ${className}`}
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
      title={remark}
    >
      {remark}
    </span>
  );
}

function QualifiedBadge() {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.58rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)] shrink-0 leading-none"
      style={{
        background: "color-mix(in oklch, var(--brand-primary) 12%, transparent)",
        color: "var(--brand-primary)",
        border: "1px solid color-mix(in oklch, var(--brand-primary) 25%, transparent)",
      }}
      title="Kvalifikovan za finale"
    >
      Q
    </span>
  );
}

interface Props {
  results: CompResultRow[];
}

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
  const isSeriesType =
    firstWithDetail?.qualDetail != null && "series" in firstWithDetail.qualDetail;
  const isPositionsType =
    firstWithDetail?.qualDetail != null && "kneeling" in firstWithDetail.qualDetail;
  const seriesCount = isSeriesType
    ? (firstWithDetail!.qualDetail as { series: number[] }).series.length
    : 0;
  // R3P-style disciplines sometimes store per-position series flat (2 series per stance = 6)
  const isR3PFlatPositions = isSeriesType && seriesCount === 6 && (results[0]?.disciplineCode?.startsWith("R3P") ?? false);

  // Per-position sub-series column counts (may differ, e.g. standing split into 2 series)
  const posSeriesCounts = isPositionsType
    ? POSITION_KEYS.reduce((acc, pos) => {
        acc[pos] = Math.max(0, ...results.map((r) => (r.qualDetail as PositionsQualDetail | null)?.[pos]?.series.length ?? 0));
        return acc;
      }, {} as Record<(typeof POSITION_KEYS)[number], number>)
    : null;

  const showGroupHeader = isPositionsType || isR3PFlatPositions;

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

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm border-collapse"
          style={{
            minWidth: isSeriesType
              ? `${360 + seriesCount * 68}px`
              : isPositionsType && posSeriesCounts
                ? `${420 + (posSeriesCounts.kneeling + posSeriesCounts.prone + posSeriesCounts.standing) * 60}px`
                : "480px",
          }}
        >
          <thead>
            {/* Stance group header (R3P-style disciplines) */}
            {showGroupHeader && (
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th colSpan={3} />
                {POSITION_KEYS.map((pos, pi) => (
                  <th
                    key={pos}
                    colSpan={isPositionsType ? posSeriesCounts![pos] : 2}
                    className={`px-3 py-1 text-center text-[0.6rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)] ${pi > 0 ? "border-l border-[var(--border)]" : ""}`}
                  >
                    {POSITION_LABELS[pi]}
                  </th>
                ))}
                <th colSpan={1 + (showInners ? 1 : 0) + 1} />
              </tr>
            )}
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-12">
                #
              </th>
              <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Strelac
              </th>
              <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Klub / NOC
              </th>

              {/* Series columns */}
              {isSeriesType &&
                Array.from({ length: seriesCount }).map((_, i) => (
                  <th
                    key={i}
                    className={`px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${isR3PFlatPositions && i % 2 === 0 && i > 0 ? "border-l border-[var(--border)]" : ""}`}
                    style={{ minWidth: "64px" }}
                  >
                    S{i + 1}
                  </th>
                ))}

              {/* Position sub-series columns */}
              {isPositionsType &&
                posSeriesCounts &&
                POSITION_KEYS.flatMap((pos, pi) =>
                  Array.from({ length: posSeriesCounts[pos] }).map((_, si) => (
                    <th
                      key={`${pos}-${si}`}
                      className={`px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] ${si === 0 && pi > 0 ? "border-l border-[var(--border)]" : ""}`}
                      style={{ minWidth: "56px" }}
                    >
                      S{si + 1}
                    </th>
                  ))
                )}

              {/* Total */}
              <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink)] w-20">
                Σ
              </th>

              {/* Inners */}
              {showInners && (
                <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-12">
                  ×
                </th>
              )}

              {/* Remarks */}
              <th className="px-3 py-3 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-16">
                Nap.
              </th>
            </tr>
          </thead>
          <tbody>
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

              return (
                <tr
                  key={r.id}
                  className={`border-b border-[var(--border)] last:border-b-0 transition-colors hover:bg-[var(--surface-2)] ${
                    isOddRow ? "bg-[var(--surface)]" : ""
                  }`}
                >
                  {/* Rank */}
                  <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums">
                    {r.qualRank != null ? (
                      <span className={r.qualRank <= 3 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}>
                        {r.qualRank}
                      </span>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-2.5">
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
                  </td>

                  {/* Club / NOC */}
                  <td className="px-4 py-2.5">
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
                  </td>

                  {/* Series values */}
                  {isSeriesType &&
                    Array.from({ length: seriesCount }).map((_, i) => {
                      const val = seriesArr?.[i];
                      const isBest = i === bestSeriesIdx && val != null;
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums ${
                            isBest
                              ? "text-[var(--ink)] font-semibold"
                              : "text-[var(--muted)]"
                          } ${isR3PFlatPositions && i % 2 === 0 && i > 0 ? "border-l border-[var(--border)]" : ""}`}
                        >
                          {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                        </td>
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
                          <td
                            key={`${pos}-${si}`}
                            className={`px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)] ${si === 0 && pi > 0 ? "border-l border-[var(--border)]" : ""}`}
                          >
                            {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                          </td>
                        );
                      });
                    })}

                  {/* Total */}
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm tabular-nums text-[var(--ink)]">
                    {r.qualTotal != null
                      ? fmt(parseFloat(r.qualTotal))
                      : <span className="font-normal text-[var(--subtle)]">—</span>}
                  </td>

                  {/* Inners */}
                  {showInners && (
                    <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">
                      {r.qualInners != null ? (
                        <>{r.qualInners}<span className="text-[0.6rem]">×</span></>
                      ) : (
                        <span className="text-[var(--subtle)]">—</span>
                      )}
                    </td>
                  )}


                  {/* Remarks: DSQ/DNS/DNF/SO/RPO from result, or Q for top-8 finalists */}
                  <td className="px-3 py-2.5 text-center">
                    {r.remark ? (
                      <RemarkBadge remark={r.remark} className="" />
                    ) : isTopQual ? (
                      <QualifiedBadge />
                    ) : (
                      <span className="text-[var(--subtle)] text-xs">—</span>
                    )}
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
