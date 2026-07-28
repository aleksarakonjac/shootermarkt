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
    <div className="overflow-x-auto">
      <table className="border-collapse" style={{ minWidth: `${series.length * 64 + 80}px` }}>
        <thead>
          <tr>
            {series.map((_, i) => (
              <th
                key={i}
                className="px-3 py-1.5 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--muted)] text-[0.65rem] border-r border-[var(--border)] last:border-r-0"
                style={{ width: "60px" }}
              >
                S{i + 1}
              </th>
            ))}
            <th
              className="px-3 py-1.5 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--ink)] text-[0.65rem]"
              style={{ width: "76px" }}
            >
              Σ
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {series.map((v, i) => (
              <td
                key={i}
                className={`px-3 py-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums border-r border-[var(--border)] last:border-r-0 ${
                  i === bestIdx
                    ? "text-[var(--ink)] bg-[var(--surface-2)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {fmt(v)}
              </td>
            ))}
            <td className="px-3 py-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)]">
              {fmt(total)}
              {inners != null && (
                <span className="block text-[0.6rem] font-normal text-[var(--muted)] leading-none mt-0.5">
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
