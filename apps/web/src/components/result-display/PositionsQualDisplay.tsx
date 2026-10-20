import type { PositionsQualDetail } from "@shootermarkt/db/schema";

interface Props {
  detail: PositionsQualDetail;
  hasDecimals?: boolean;
}

const POSITION_LABELS = {
  sr: { kneeling: "Klečeći", prone: "Ležeći", standing: "Stojeći" },
  en: { kneeling: "Kneeling", prone: "Prone", standing: "Standing" },
} as const;

type Position = keyof typeof POSITION_LABELS.sr;

export function PositionsQualDisplay({ detail, hasDecimals = false, locale = "sr", showGrandTotal = true }: Props & { locale?: string; showGrandTotal?: boolean }) {
  const fmt = (v: number) =>
    hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  const positions: Position[] = ["kneeling", "prone", "standing"];
  const labels = locale === "en" ? POSITION_LABELS.en : POSITION_LABELS.sr;
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
            <th className="px-3 py-1.5 text-left font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--muted)] text-xs w-24">
              Stav
            </th>
            {Array.from({ length: maxSeries }).map((_, i) => (
              <th
                key={i}
                className="px-3 py-1.5 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--muted)] text-xs"
                style={{ minWidth: "60px" }}
              >
                S{i + 1}
              </th>
            ))}
            <th
              className="px-3 py-1.5 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--ink)] text-xs"
              style={{ minWidth: "72px" }}
            >
              Stav Σ
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, pi) => {
            const { series, total } = detail[pos];
            // Zaokruženo na 0.1 da float greška zbira (10.4 + 10.6 …) ne razbije jednakost serija.
            const seriesTotals = series.map((s) => Math.round(s.reduce((a, b) => a + b, 0) * 10) / 10);
            // Sve serije jednake najboljoj se ističu (npr. više 100-ki u trostavu).
            const bestSeriesTotal = seriesTotals.length > 0 ? Math.max(...seriesTotals) : null;

            return (
              <tr
                key={pos}
                className={
                  pi < positions.length - 1
                    ? "border-b border-[var(--border)]"
                    : ""
                }
              >
                <td className="px-3 py-1.5 font-[family-name:var(--font-barlow-condensed)] font-semibold text-xs uppercase tracking-wide text-[var(--ink)]">
                  {labels[pos]}
                </td>
                {series.map((s, si) => {
                  const st = seriesTotals[si];
                  const isBest = bestSeriesTotal != null && st === bestSeriesTotal;
                  return (
                    <td
                      key={si}
                      className={`px-3 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums transition-colors ${
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
                        className="px-3 py-1.5 text-center text-[var(--subtle)]"
                      >
                        —
                      </td>
                    )
                  )}
                <td className="px-3 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)]">
                  {fmt(total)}
                </td>
              </tr>
            );
          })}

          {showGrandTotal && <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface)]"><td className="px-3 py-1.5 font-[family-name:var(--font-barlow-condensed)] font-bold text-xs uppercase tracking-wide text-[var(--ink)]">{locale === "en" ? "Total" : "Ukupno"}</td>{Array.from({ length: maxSeries }).map((_, i) => <td key={i} className="px-3 py-2" />)}<td className="px-3 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-base font-bold tabular-nums text-[var(--ink)]">{fmt(grandTotal)}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
