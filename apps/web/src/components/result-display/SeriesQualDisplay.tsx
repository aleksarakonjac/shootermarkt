import type { SeriesQualDetail } from "@shootermarkt/db/schema";

interface Props {
  detail: SeriesQualDetail;
  hasDecimals?: boolean;
  inners?: number | null;
  total?: number | null;
  columnCount?: number;
  groupLabels?: string[];
  showTotal?: boolean;
}

export function SeriesQualDisplay({ detail, hasDecimals = false, inners, total: storedTotal, columnCount, groupLabels, showTotal = true }: Props) {
  const { series } = detail;
  if (!series?.length) return null;

  const displaySeries = Array.from({ length: Math.max(series.length, columnCount ?? 0) }, (_, index) => series[index] ?? null);
  const total = storedTotal ?? series.reduce((a, b) => a + b, 0);
  const bestIdx = series.indexOf(Math.max(...series));

  const fmt = (v: number) =>
    hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  return (
    <div>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {displaySeries.map((_, i) => <col key={i} style={{ width: `${(showTotal ? 80 : 100) / displaySeries.length}%` }} />)}
          {showTotal && <col style={{ width: "20%" }} />}
        </colgroup>
        {groupLabels && (
          <thead>
            <tr>
              {groupLabels.map((label) => <th key={label} colSpan={2} className="border-r border-[var(--border)] px-1 pb-1 text-center text-[0.6rem] font-semibold text-[var(--subtle)] last:border-r-0">{label}</th>)}
              {showTotal && <th />}
            </tr>
          </thead>
        )}
        <tbody>
          <tr>
            {displaySeries.map((v, i) => (
              <td
                key={i}
                className={`whitespace-nowrap px-1 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums border-r border-[var(--border)] last:border-r-0 sm:px-2 sm:text-sm ${
                  v != null && i === bestIdx
                    ? "text-[var(--ink)] bg-[var(--surface-2)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {v != null ? fmt(v) : "—"}
              </td>
            ))}
            {showTotal && <td className="whitespace-nowrap px-1 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tabular-nums text-[var(--ink)] sm:px-2 sm:text-sm"><span className="grid grid-cols-[1fr_1.5rem] items-baseline"><span className="text-right">{fmt(total)}</span><span className="text-right text-[0.6rem] font-normal text-[var(--muted)]">{inners != null && <>{inners}<span className="text-[0.55rem]">×</span></>}</span></span></td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
