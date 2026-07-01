import type { PositionsQualDetail } from "@/lib/db/schema";

interface Props {
  detail: PositionsQualDetail;
  hasDecimals?: boolean;
}

const POSITION_LABELS = {
  kneeling: "Klečeći",
  prone:    "Ležeći",
  standing: "Stojeći",
} as const;

type Position = keyof typeof POSITION_LABELS;

export function PositionsQualDisplay({ detail, hasDecimals = false }: Props) {
  const fmt = (v: number) =>
    hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  const positions: Position[] = ["kneeling", "prone", "standing"];
  const maxSeries = Math.max(...positions.map((p) => detail[p].series.length));
  const grandTotal =
    detail.kneeling.total + detail.prone.total + detail.standing.total;

  return (
    <div className="overflow-x-auto">
      <table
        className="border-collapse"
        style={{ minWidth: `${24 + maxSeries * 64 + 80}px` }}
      >
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="px-3 py-1.5 text-left font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--muted)] text-[0.65rem] w-24">
              Stav
            </th>
            {Array.from({ length: maxSeries }).map((_, i) => (
              <th
                key={i}
                className="px-3 py-1.5 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--muted)] text-[0.65rem]"
                style={{ minWidth: "60px" }}
              >
                S{i + 1}
              </th>
            ))}
            <th
              className="px-3 py-1.5 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--ink)] text-[0.65rem]"
              style={{ minWidth: "72px" }}
            >
              Stav Σ
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, pi) => {
            const { series, total } = detail[pos];
            const seriesTotals = series.map((s) => s.reduce((a, b) => a + b, 0));
            const bestSeriesIdx =
              seriesTotals.length > 0
                ? seriesTotals.indexOf(Math.max(...seriesTotals))
                : -1;

            return (
              <tr
                key={pos}
                className={
                  pi < positions.length - 1
                    ? "border-b border-[var(--border)]"
                    : ""
                }
              >
                <td className="px-3 py-2 font-[family-name:var(--font-barlow-condensed)] font-semibold text-xs uppercase tracking-wide text-[var(--ink)]">
                  {POSITION_LABELS[pos]}
                </td>
                {series.map((s, si) => {
                  const st = seriesTotals[si];
                  const isBest = si === bestSeriesIdx;
                  return (
                    <td
                      key={si}
                      className={`px-3 py-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums transition-colors ${
                        isBest
                          ? "text-[var(--ink)] bg-[var(--surface-2)]"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {fmt(st)}
                    </td>
                  );
                })}
                {series.length < maxSeries &&
                  Array.from({ length: maxSeries - series.length }).map(
                    (_, i) => (
                      <td
                        key={`gap-${i}`}
                        className="px-3 py-2 text-center text-[var(--subtle)]"
                      >
                        —
                      </td>
                    )
                  )}
                <td className="px-3 py-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)]">
                  {fmt(total)}
                </td>
              </tr>
            );
          })}

          {/* Grand total */}
          <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface)]">
            <td className="px-3 py-2 font-[family-name:var(--font-barlow-condensed)] font-bold text-xs uppercase tracking-wide text-[var(--ink)]">
              Ukupno
            </td>
            {Array.from({ length: maxSeries }).map((_, i) => (
              <td key={i} className="px-3 py-2" />
            ))}
            <td className="px-3 py-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-base font-bold tabular-nums text-[var(--ink)]">
              {fmt(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
