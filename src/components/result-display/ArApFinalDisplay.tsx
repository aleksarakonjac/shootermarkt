import type { ArApFinalDetail } from "@/lib/db/schema";

interface Props {
  detail: ArApFinalDetail;
}

export function ArApFinalDisplay({ detail }: Props) {
  const { phase1, phase2, total } = detail;

  // Cumulative scores starting from phase1 subtotal
  let running = phase1.subtotal;
  const cumulative = phase2.shots.map((v) => {
    running += v;
    return running;
  });

  const eliminatedAfterShot = phase2.eliminatedAfterShot;

  return (
    <div className="space-y-4">
      {/* Phase 1 — 2 series of 5 shots */}
      <div>
        <p className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)] mb-2">
          Faza 1 — Serije
        </p>
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                {phase1.series.flatMap((s, si) =>
                  s.map((_, hi) => (
                    <th
                      key={`${si}-${hi}`}
                      className={`px-2.5 py-1 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] text-[var(--muted)] text-[0.6rem] ${
                        hi === s.length - 1 && si < phase1.series.length - 1
                          ? "border-r-2 border-[var(--border-strong)]"
                          : "border-r border-[var(--border)]"
                      } last:border-r-0`}
                      style={{ minWidth: "44px" }}
                    >
                      {si * s.length + hi + 1}
                    </th>
                  ))
                )}
                <th
                  className="px-3 py-1 text-center font-semibold font-[family-name:var(--font-barlow-condensed)] text-[var(--ink)] text-[0.65rem]"
                  style={{ minWidth: "60px" }}
                >
                  Σ
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {phase1.series.flatMap((s, si) =>
                  s.map((v, hi) => (
                    <td
                      key={`${si}-${hi}`}
                      className={`px-2.5 py-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--muted)] ${
                        hi === s.length - 1 && si < phase1.series.length - 1
                          ? "border-r-2 border-[var(--border-strong)]"
                          : "border-r border-[var(--border)]"
                      } last:border-r-0`}
                    >
                      {v.toFixed(1)}
                    </td>
                  ))
                )}
                <td className="px-3 py-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)]">
                  {phase1.subtotal.toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 2 — individual shots */}
      {phase2.shots.length > 0 && (
        <div>
          <p className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)] mb-2">
            Faza 2 — Individualni hitci
          </p>
          <div className="overflow-x-auto">
            <div className="flex gap-1 flex-nowrap pb-1">
              {phase2.shots.map((v, i) => {
                const shotNum = i + 1;
                const isEliminated = eliminatedAfterShot === shotNum;
                const afterElim =
                  eliminatedAfterShot != null && shotNum > eliminatedAfterShot;

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded min-w-[44px] transition-opacity ${
                      isEliminated
                        ? "bg-[var(--brand-primary)] text-white"
                        : afterElim
                          ? "bg-[var(--surface-2)] opacity-30"
                          : "bg-[var(--surface-2)]"
                    }`}
                    title={
                      isEliminated
                        ? `Eliminisan posle hitca ${shotNum}`
                        : undefined
                    }
                  >
                    <span
                      className={`font-[family-name:var(--font-barlow-condensed)] text-[0.58rem] font-semibold uppercase leading-none ${
                        isEliminated ? "text-white/60" : "text-[var(--subtle)]"
                      }`}
                    >
                      {shotNum}
                    </span>
                    <span
                      className={`font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-sm leading-none ${
                        isEliminated ? "text-white" : "text-[var(--ink)]"
                      }`}
                    >
                      {v.toFixed(1)}
                    </span>
                    <span
                      className={`font-[family-name:var(--font-jetbrains-mono)] text-[0.58rem] tabular-nums leading-none ${
                        isEliminated ? "text-white/60" : "text-[var(--subtle)]"
                      }`}
                    >
                      {cumulative[i].toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {eliminatedAfterShot == null && (
            <p className="text-[0.65rem] font-semibold text-[var(--success)] mt-2">
              Završio finalni meč
            </p>
          )}
        </div>
      )}

      {/* Total */}
      <div className="flex items-baseline gap-3 border-t border-[var(--border)] pt-3">
        <span className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)]">
          Final total
        </span>
        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-lg tabular-nums text-[var(--ink)]">
          {total.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
