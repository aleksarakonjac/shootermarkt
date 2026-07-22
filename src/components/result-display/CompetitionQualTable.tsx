import { Link } from "@/i18n/navigation";
import type { QualDetail } from "@/lib/db/schema";
import { NOC_LIST } from "@/components/ui/NocDropdown";

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

function RemarkBadge({ remark }: { remark: string }) {
  const style = REMARK_STYLE[remark] ?? REMARK_STYLE.DNS;
  return (
    <span
      className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[0.58rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)] shrink-0 leading-none"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
      title={remark}
    >
      {remark}
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
    (results[0]?.disciplineCode?.startsWith("AR") ?? false) ||
    (results[0]?.disciplineCode?.startsWith("R3P") ?? false);

  // Detect display type from first result with qualDetail
  const firstWithDetail = results.find((r) => r.qualDetail != null);
  const isSeriesType =
    firstWithDetail?.qualDetail != null && "series" in firstWithDetail.qualDetail;
  const isPositionsType =
    firstWithDetail?.qualDetail != null && "kneeling" in firstWithDetail.qualDetail;
  const seriesCount = isSeriesType
    ? (firstWithDetail!.qualDetail as { series: number[] }).series.length
    : 0;
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
        <table className="w-full text-sm border-collapse" style={{ minWidth: isSeriesType ? `${360 + seriesCount * 68}px` : "480px" }}>
          <thead>
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
                    className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]"
                    style={{ minWidth: "64px" }}
                  >
                    S{i + 1}
                  </th>
                ))}

              {/* Position columns */}
              {isPositionsType && (
                <>
                  <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]" style={{ minWidth: "72px" }}>
                    Klec
                  </th>
                  <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]" style={{ minWidth: "72px" }}>
                    Lez
                  </th>
                  <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]" style={{ minWidth: "72px" }}>
                    Stoj
                  </th>
                </>
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

              {/* Qualified */}
              <th className="px-3 py-3 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-10">
                F
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
                  ? (r.qualDetail as {
                      kneeling: { series: number[][]; total: number };
                      prone:    { series: number[][]; total: number };
                      standing: { series: number[][]; total: number };
                    })
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
                      {r.remark && <RemarkBadge remark={r.remark} />}
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
                          }`}
                        >
                          {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                        </td>
                      );
                    })}

                  {/* Position subtotals */}
                  {isPositionsType && (
                    <>
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)]">
                        {posDetail ? fmt(posDetail.kneeling.total) : <span className="text-[var(--subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)]">
                        {posDetail ? fmt(posDetail.prone.total) : <span className="text-[var(--subtle)]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)]">
                        {posDetail ? fmt(posDetail.standing.total) : <span className="text-[var(--subtle)]">—</span>}
                      </td>
                    </>
                  )}

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


                  {/* Qualified mark */}
                  <td className="px-3 py-2.5 text-center">
                    {isTopQual ? (
                      <span
                        className="inline-block w-4 h-4 rounded-full text-[0.6rem] font-bold text-white flex items-center justify-center"
                        style={{ background: "var(--brand-primary)" }}
                        title="Finalista"
                        aria-label="Ušao u finale"
                      >
                        ✓
                      </span>
                    ) : r.qualified === false ? (
                      <span className="text-[var(--subtle)] text-xs">—</span>
                    ) : null}
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
