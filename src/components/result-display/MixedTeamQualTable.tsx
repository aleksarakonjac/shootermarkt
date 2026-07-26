import { Link } from "@/i18n/navigation";
import { NOC_LIST } from "@/components/ui/NocDropdown";

export type MixedTeamRow = {
  id: number;
  nocCode: string;
  shooter1Id: number | null;
  shooter2Id: number | null;
  shooter1Name: string | null;
  shooter2Name: string | null;
  shooter1Detail: { series: number[]; total: number } | null;
  shooter2Detail: { series: number[]; total: number } | null;
  qualRank: number | null;
  qualTotal: string | null;
  qualified: boolean | null;
  finalRank: number | null;
  finalTotal: string | null;
};

interface Props {
  teams: MixedTeamRow[];
  /** air_rifle → decimals (10.9), air_pistol → integers */
  apparatus: string | null;
}

// Fixed pixel widths — see CompetitionQualTable for why CSS Grid (not a real
// <table>) is required for sticky columns to actually stick.
const RANK_W = "40px";
const NAME_W = "minmax(200px, 1fr)";
const SERIES_W = "60px";
const TOTAL_W = "80px";
const STATUS_W = "40px";

export function MixedTeamQualTable({ teams, apparatus }: Props) {
  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Nema rezultata za ovu disciplinu.</p>
      </div>
    );
  }

  const hasDecimals = apparatus === "air_rifle";
  const fmt = (v: number) => hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  // Determine series count from first team with detail
  const firstWithDetail = teams.find(
    (t) => t.shooter1Detail?.series?.length || t.shooter2Detail?.series?.length
  );
  const seriesCount =
    firstWithDetail?.shooter1Detail?.series?.length ??
    firstWithDetail?.shooter2Detail?.series?.length ??
    6;

  const sorted = [...teams].sort((a, b) => {
    if (a.qualRank == null && b.qualRank == null) return 0;
    if (a.qualRank == null) return 1;
    if (b.qualRank == null) return -1;
    return a.qualRank - b.qualRank;
  });

  const gridTemplateColumns = [RANK_W, NAME_W, `repeat(${seriesCount}, ${SERIES_W})`, TOTAL_W, STATUS_W].join(" ");
  const totalCols = 2 + seriesCount + 2;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <div role="table" className="text-sm grid" style={{ gridTemplateColumns, minWidth: `${totalCols * 56 + 60}px` }}>
          <div role="row" style={{ display: "contents" }}>
            <div role="columnheader" className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center justify-end bg-[var(--surface)] border-b border-[var(--border)]">
              #
            </div>
            <div role="columnheader" className="px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center bg-[var(--surface)] border-b border-[var(--border)]">
              Tim / Strelac
            </div>
            {Array.from({ length: seriesCount }).map((_, i) => (
              <div key={i} role="columnheader" className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center justify-end bg-[var(--surface)] border-b border-[var(--border)]">
                S{i + 1}
              </div>
            ))}
            <div
              role="columnheader"
              className="sticky flex items-center justify-end px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink)] border-b border-[var(--border)]"
              style={{ right: STATUS_W, background: "var(--surface)", zIndex: 1 }}
            >
              Σ
            </div>
            <div
              role="columnheader"
              className="sticky flex items-center justify-center px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]"
              style={{ right: 0, background: "var(--surface)", zIndex: 1 }}
            >
              F
            </div>
          </div>

          {sorted.map((team, teamIdx) => {
            const isOdd = teamIdx % 2 === 1;
            const rowBg = isOdd ? "var(--surface)" : "var(--bg)";

            const alpha2 = NOC_LIST.find((n) => n.noc === team.nocCode)?.alpha2;

            const s1 = team.shooter1Detail;
            const s2 = team.shooter2Detail;

            const best1Idx = s1 ? s1.series.indexOf(Math.max(...s1.series)) : -1;
            const best2Idx = s2 ? s2.series.indexOf(Math.max(...s2.series)) : -1;

            return (
              <div key={team.id} role="rowgroup" style={{ display: "contents" }}>
                {/* ── Shooter 1 row (man for rifle, or first for pistol) ── */}
                <div role="row" className="group" style={{ display: "contents" }}>
                  {/* Rank (spans shooter 1 + shooter 2 rows) */}
                  <div
                    className="px-3 py-2.5 text-right flex items-center justify-end border-b border-[var(--border)] group-hover:bg-[var(--surface-2)] transition-colors"
                    style={{ gridRow: "span 2", background: rowBg }}
                  >
                    {team.qualRank != null ? (
                      <span className={`font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums ${
                        team.qualRank <= 3 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"
                      }`}>
                        {team.qualRank}
                      </span>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </div>

                  {/* NOC + name (shooter 1) */}
                  <div className="px-4 py-2 flex items-center group-hover:bg-[var(--surface-2)] transition-colors" style={{ background: rowBg }}>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">
                        {alpha2 && (
                          <span
                            className={`fi fi-${alpha2.toLowerCase()}`}
                            style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block", flexShrink: 0 }}
                          />
                        )}
                        {team.nocCode}
                      </span>
                      {team.shooter1Id ? (
                        <Link
                          href={`/strelci/${team.shooter1Id}`}
                          className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors text-sm"
                        >
                          {team.shooter1Name ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--ink)] text-sm">{team.shooter1Name ?? "—"}</span>
                      )}
                      <span className="text-[0.6rem] font-bold text-[var(--muted)] uppercase tracking-wide ml-0.5">M</span>
                    </div>
                  </div>

                  {/* Series — shooter 1 */}
                  {Array.from({ length: seriesCount }).map((_, i) => {
                    const val = s1?.series[i];
                    return (
                      <div
                        key={i}
                        className={`px-3 py-2 text-right flex items-center justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums group-hover:bg-[var(--surface-2)] transition-colors ${
                          i === best1Idx && val != null ? "text-[var(--ink)] font-semibold" : "text-[var(--muted)]"
                        }`}
                        style={{ background: rowBg }}
                      >
                        {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                      </div>
                    );
                  })}

                  {/* Subtotal — shooter 1 — pinned right on mobile */}
                  <div
                    className="sticky flex items-center justify-end px-4 py-2 font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--ink)] font-semibold"
                    style={{ right: STATUS_W, background: rowBg, zIndex: 1 }}
                  >
                    {s1?.total != null ? fmt(s1.total) : <span className="font-normal text-[var(--subtle)]">—</span>}
                  </div>

                  {/* Q — spans shooter 1 + shooter 2 rows — pinned right */}
                  <div
                    className="sticky flex items-center justify-center px-3 py-2.5 border-b border-[var(--border)]"
                    style={{ gridRow: "span 2", right: 0, background: rowBg, zIndex: 1 }}
                  >
                    {team.qualified === true ? (
                      <span
                        className="inline-block w-4 h-4 rounded-full text-[0.6rem] font-bold text-white flex items-center justify-center"
                        style={{ background: "var(--brand-primary)" }}
                        title="Finalista"
                      >
                        ✓
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* ── Shooter 2 row (woman) ── */}
                <div role="row" className="group" style={{ display: "contents" }}>
                  {/* NOC + name (shooter 2) */}
                  <div className="px-4 py-2 flex items-center border-b border-[var(--border)] group-hover:bg-[var(--surface-2)] transition-colors" style={{ background: rowBg }}>
                    <div className="flex items-center gap-2">
                      <span className="w-[2.75rem] shrink-0" />
                      {team.shooter2Id ? (
                        <Link
                          href={`/strelci/${team.shooter2Id}`}
                          className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors text-sm"
                        >
                          {team.shooter2Name ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--ink)] text-sm">{team.shooter2Name ?? "—"}</span>
                      )}
                      <span className="text-[0.6rem] font-bold text-[var(--muted)] uppercase tracking-wide ml-0.5">Ž</span>
                    </div>
                  </div>

                  {/* Series — shooter 2 */}
                  {Array.from({ length: seriesCount }).map((_, i) => {
                    const val = s2?.series[i];
                    return (
                      <div
                        key={i}
                        className={`px-3 py-2 text-right flex items-center justify-end border-b border-[var(--border)] font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums group-hover:bg-[var(--surface-2)] transition-colors ${
                          i === best2Idx && val != null ? "text-[var(--ink)] font-semibold" : "text-[var(--muted)]"
                        }`}
                        style={{ background: rowBg }}
                      >
                        {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                      </div>
                    );
                  })}

                  {/* Subtotal — shooter 2 — pinned right */}
                  <div
                    className="sticky flex items-center justify-end px-4 py-2 border-b border-[var(--border)] font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--ink)] font-semibold"
                    style={{ right: STATUS_W, background: rowBg, zIndex: 1 }}
                  >
                    {s2?.total != null ? fmt(s2.total) : <span className="font-normal text-[var(--subtle)]">—</span>}
                  </div>
                </div>

                {/* ── Team total row ── */}
                <div role="row" style={{ display: "contents" }}>
                  <div style={{ background: rowBg }} className="border-b-2 border-[var(--border)]" />
                  <div className="px-4 pb-2.5 pt-1 flex items-center border-b-2 border-[var(--border)]" style={{ background: rowBg }}>
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--muted)]">
                      Tim ukupno
                    </span>
                  </div>
                  {Array.from({ length: seriesCount }).map((_, i) => (
                    <div key={i} className="border-b-2 border-[var(--border)]" style={{ background: rowBg }} />
                  ))}
                  {/* Team total — pinned right */}
                  <div
                    className="sticky flex items-center justify-end px-4 pb-2.5 pt-1 border-b-2 border-[var(--border)] font-[family-name:var(--font-jetbrains-mono)] font-bold text-base tabular-nums text-[var(--ink)]"
                    style={{ right: STATUS_W, background: rowBg, zIndex: 1 }}
                  >
                    {team.qualTotal ?? <span className="font-normal text-[var(--subtle)]">—</span>}
                  </div>
                  <div className="sticky border-b-2 border-[var(--border)]" style={{ right: 0, background: rowBg, zIndex: 1 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
