import type { BulletinFinalDetail } from "@/lib/db/schema";

export function BulletinFinalDisplay({ detail, ranks }: { detail: BulletinFinalDetail; ranks?: Array<number | null> | null }) {
  const hasData = detail.series?.length || detail.shots?.length || detail.cumulative?.length;
  const isHitCount = detail.scoring === "hit_count";
  const fmt = (value: number) => isHitCount ? String(value) : value.toFixed(1);

  if (!hasData) return null;

  return (
    <div className="space-y-4">
      {isHitCount ? (
        <div>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Tok finala - pogodci</p>
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-[0.6rem] font-semibold text-[var(--muted)]">Red</th>
                  {Array.from({ length: Math.max(detail.cumulative?.length ?? 0, detail.series?.length ?? 0) }, (_, index) => (
                    <th key={index} className="min-w-12 border-l border-[var(--border)] px-2 py-1 text-center text-[0.6rem] font-semibold text-[var(--muted)]">S{index + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border)]">
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-[var(--ink)]">Ukupno</th>
                  {Array.from({ length: Math.max(detail.cumulative?.length ?? 0, detail.series?.length ?? 0) }, (_, index) => <td key={index} className="border-l border-[var(--border)] px-2 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)]">{detail.cumulative?.[index] ?? "-"}</td>)}
                </tr>
                <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-[var(--muted)]">U seriji</th>
                  {Array.from({ length: Math.max(detail.cumulative?.length ?? 0, detail.series?.length ?? 0) }, (_, index) => <td key={index} className="border-l border-[var(--border)] px-2 py-1.5 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)]">{detail.series?.[index] ?? "-"}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!isHitCount && detail.series?.length ? (
        <div>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Serije finala</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.series.map((value, index) => (
              <div key={index} className="min-w-12 rounded bg-[var(--surface-2)] px-2 py-1 text-center">
                <div className="text-[0.6rem] font-semibold text-[var(--subtle)]">{detail.seriesLabels?.[index] ?? `S${index + 1}`}</div>
                <div className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)]">{fmt(value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isHitCount && detail.shots?.length ? (
        <div>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Pojedinačni hici</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.shots.map((value, index) => (
              <div key={index} className="min-w-11 rounded bg-[var(--surface-2)] px-2 py-1 text-center">
                <div className="text-[0.6rem] font-semibold text-[var(--subtle)]">{index + 1}</div>
                <div className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)]">{fmt(value)}</div>
                {detail.cumulative?.[index] != null ? <div className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] tabular-nums text-[var(--muted)]">{fmt(detail.cumulative[index])}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isHitCount && !detail.shots?.length && detail.cumulative?.length ? (
        <div>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kumulativni tok</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.cumulative.map((value, index) => (
              <div key={index} className="min-w-12 rounded bg-[var(--surface-2)] px-2 py-1 text-center">
                <div className="text-[0.6rem] font-semibold text-[var(--subtle)]">F{index + 1}</div>
                <div className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)]">{fmt(value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isHitCount && detail.cumulative?.length && ranks?.some((rank) => rank != null) ? (
        <div>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Plasman tokom finala</p>
          <div className="overflow-x-auto">
            <div className="flex w-max gap-1.5 pb-1">
              {detail.cumulative.map((value, index) => (
                <div key={index} className="min-w-14 rounded bg-[var(--surface-2)] px-2 py-1 text-center">
                  <div className="text-[0.6rem] font-semibold text-[var(--subtle)]">F{index + 1}</div>
                  <div className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)]">{fmt(value)}</div>
                  <div className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] font-semibold tabular-nums text-[var(--muted)]">{ranks[index] != null ? `#${ranks[index]}` : "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
