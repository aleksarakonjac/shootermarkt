import type { SeriesQualDetail } from "@shootermarkt/db/schema";

interface Props {
  detail: SeriesQualDetail;
  hasDecimals?: boolean;
  inners?: number | null;
}

export function SeriesQualDisplay({ detail, hasDecimals = false, inners }: Props) {
  const { series } = detail;
  if (!series?.length) return null;

  const total = series.reduce((a, b) => a + b, 0);
  const bestIdx = series.indexOf(Math.max(...series));

  const fmt = (v: number) =>
    hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  return (
    <div>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {series.map((_, i) => <col key={i} style={{ width: `${80 / series.length}%` }} />)}
          <col style={{ width: "20%" }} />
        </colgroup>
        <tbody>
          <tr>
            {series.map((v, i) => (
              <td
                key={i}
                className={`whitespace-nowrap px-1 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums border-r border-[var(--border)] last:border-r-0 sm:px-2 sm:text-sm ${
                  i === bestIdx
                    ? "text-[var(--ink)] bg-[var(--surface-2)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {fmt(v)}
              </td>
            ))}
            <td className="whitespace-nowrap px-1 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold tabular-nums text-[var(--ink)] sm:px-2 sm:text-sm">
              {fmt(total)}
              {inners != null && (
                <span className="ml-0.5 text-[0.6rem] font-normal text-[var(--muted)]">
                  {inners}
                  <span className="text-[0.55rem]">×</span>
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
