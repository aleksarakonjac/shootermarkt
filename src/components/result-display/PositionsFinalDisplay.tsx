import type { PositionsFinalDetail } from "@/lib/db/schema";

interface Props {
  detail: PositionsFinalDetail;
}

const POS_LABELS = {
  kneeling: "Klečeći",
  prone:    "Ležeći",
  standing: "Stojeći",
} as const;

export function PositionsFinalDisplay({ detail }: Props) {
  const { phase1, phase2, total } = detail;

  let running = phase1.subtotal;
  const cumulative = phase2.shots.map((v) => {
    running += v;
    return running;
  });

  const hasDecimals = detail.format === "3x40_mk";
  const fmt = (v: number) =>
    hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  return (
    <div className="space-y-4">
      {/* Phase 1 — by position */}
      <div>
        <p className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)] mb-2">
          Faza 1 — Stavovi
        </p>
        <div className="space-y-1.5">
          {(["kneeling", "prone", "standing"] as const).map((pos) => {
            const isStanding = pos === "standing";
            const data = phase1[pos];

            const shots: number[] = isStanding
              ? [
                  ...(data as { series1: number[]; series2: number[]; total: number }).series1,
                  ...(data as { series1: number[]; series2: number[]; total: number }).series2,
                ]
              : (data as { shots: number[]; total: number }).shots;

            const posTotal = isStanding
              ? (data as { series1: number[]; series2: number[]; total: number }).total
              : (data as { shots: number[]; total: number }).total;

            // For standing, find split index to show divider between series1 / series2
            const standingSplit = isStanding
              ? (data as { series1: number[] }).series1.length
              : -1;

            return (
              <div key={pos} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)]">
                  {POS_LABELS[pos]}
                </span>
                <div className="overflow-x-auto flex-1">
                  <div className="flex gap-0.5 flex-nowrap">
                    {shots.map((v, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-center px-1.5 py-1 rounded text-[0.65rem] font-[family-name:var(--font-jetbrains-mono)] tabular-nums text-[var(--muted)] min-w-[28px] bg-[var(--surface-2)] ${
                          standingSplit > 0 && i === standingSplit - 1
                            ? "mr-2"
                            : ""
                        }`}
                      >
                        {fmt(v)}
                      </div>
                    ))}
                  </div>
                </div>
                <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm tabular-nums text-[var(--ink)] shrink-0 w-12 text-right">
                  {fmt(posTotal)}
                </span>
              </div>
            );
          })}

          {/* Faza 1 subtotal row */}
          <div className="flex items-center gap-3 border-t border-[var(--border)] pt-2">
            <span className="w-20 shrink-0 text-[0.65rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--ink)]">
              Faza 1 Σ
            </span>
            <div className="flex-1" />
            <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm tabular-nums text-[var(--ink)] w-12 text-right">
              {fmt(phase1.subtotal)}
            </span>
          </div>
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
                const isEliminated = phase2.eliminatedAfterShot === shotNum;
                const afterElim =
                  phase2.eliminatedAfterShot != null &&
                  shotNum > phase2.eliminatedAfterShot;

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded min-w-[40px] transition-opacity ${
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
                      {fmt(v)}
                    </span>
                    <span
                      className={`font-[family-name:var(--font-jetbrains-mono)] text-[0.58rem] tabular-nums leading-none ${
                        isEliminated ? "text-white/60" : "text-[var(--subtle)]"
                      }`}
                    >
                      {fmt(cumulative[i])}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {phase2.eliminatedAfterShot == null && (
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
          {fmt(total)}
        </span>
      </div>
    </div>
  );
}
