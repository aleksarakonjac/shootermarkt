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

  // minWidth: rank + noc/name + series cols + total + Q
  const minWidth = 200 + seriesCount * 64 + 120;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: `${minWidth}px` }}
        >
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-10">
                #
              </th>
              <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Tim / Strelac
              </th>
              {Array.from({ length: seriesCount }).map((_, i) => (
                <th
                  key={i}
                  className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]"
                  style={{ minWidth: "60px" }}
                >
                  S{i + 1}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink)] w-20">
                Σ
              </th>
              <th className="px-3 py-3 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-10">
                F
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, teamIdx) => {
              const isOdd = teamIdx % 2 === 1;
              const rowBg = isOdd ? "bg-[var(--surface)]" : "";
              const borderBottom = "border-b border-[var(--border)]";

              const alpha2 = NOC_LIST.find((n) => n.noc === team.nocCode)?.alpha2;

              const s1 = team.shooter1Detail;
              const s2 = team.shooter2Detail;

              const best1Idx = s1 ? s1.series.indexOf(Math.max(...s1.series)) : -1;
              const best2Idx = s2 ? s2.series.indexOf(Math.max(...s2.series)) : -1;

              return (
                <>
                  {/* ── Shooter 1 row (man for rifle, or first for pistol) ── */}
                  <tr
                    key={`${team.id}-s1`}
                    className={`${rowBg} hover:bg-[var(--surface-2)] transition-colors`}
                  >
                    {/* Rank (spans 2 shooter rows) */}
                    <td rowSpan={2} className="px-3 py-2.5 text-right align-middle border-b border-[var(--border)]">
                      {team.qualRank != null ? (
                        <span className={`font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums ${
                          team.qualRank <= 3 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"
                        }`}>
                          {team.qualRank}
                        </span>
                      ) : (
                        <span className="text-[var(--subtle)]">—</span>
                      )}
                    </td>

                    {/* NOC + name (shooter 1) */}
                    <td className="px-4 py-2 border-b-0">
                      <div className="flex items-center gap-2">
                        {/* NOC badge — only on first shooter row */}
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
                    </td>

                    {/* Series — shooter 1 */}
                    {Array.from({ length: seriesCount }).map((_, i) => {
                      const val = s1?.series[i];
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums border-b-0 ${
                            i === best1Idx && val != null
                              ? "text-[var(--ink)] font-semibold"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                        </td>
                      );
                    })}

                    {/* Subtotal — shooter 1 */}
                    <td className="px-4 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--ink)] font-semibold border-b-0">
                      {s1?.total != null ? fmt(s1.total) : <span className="font-normal text-[var(--subtle)]">—</span>}
                    </td>

                    {/* Q — empty for shooter rows */}
                    <td rowSpan={2} className="px-3 py-2.5 text-center align-middle border-b border-[var(--border)]">
                      {team.qualified === true ? (
                        <span
                          className="inline-block w-4 h-4 rounded-full text-[0.6rem] font-bold text-white flex items-center justify-center"
                          style={{ background: "var(--brand-primary)" }}
                          title="Finalista"
                        >
                          ✓
                        </span>
                      ) : null}
                    </td>
                  </tr>

                  {/* ── Shooter 2 row (woman) ── */}
                  <tr
                    key={`${team.id}-s2`}
                    className={`${rowBg} ${borderBottom} hover:bg-[var(--surface-2)] transition-colors`}
                  >
                    {/* NOC + name (shooter 2) */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {/* Indent to align with name above */}
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
                    </td>

                    {/* Series — shooter 2 */}
                    {Array.from({ length: seriesCount }).map((_, i) => {
                      const val = s2?.series[i];
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums ${
                            i === best2Idx && val != null
                              ? "text-[var(--ink)] font-semibold"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          {val != null ? fmt(val) : <span className="text-[var(--subtle)]">—</span>}
                        </td>
                      );
                    })}

                    {/* Subtotal — shooter 2 */}
                    <td className="px-4 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--ink)] font-semibold">
                      {s2?.total != null ? fmt(s2.total) : <span className="font-normal text-[var(--subtle)]">—</span>}
                    </td>
                  </tr>

                  {/* ── Team total row ── */}
                  <tr
                    key={`${team.id}-total`}
                    className={`border-b-2 border-[var(--border)] last:border-b-0 ${isOdd ? "bg-[var(--surface)]" : ""}`}
                  >
                    <td />
                    <td className="px-4 pb-2.5 pt-1">
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--muted)]">
                        Tim ukupno
                      </span>
                    </td>
                    {/* Empty series cells */}
                    {Array.from({ length: seriesCount }).map((_, i) => (
                      <td key={i} />
                    ))}
                    {/* Team total */}
                    <td className="px-4 pb-2.5 pt-1 text-right font-[family-name:var(--font-jetbrains-mono)] font-bold text-base tabular-nums text-[var(--ink)]">
                      {team.qualTotal ?? <span className="font-normal text-[var(--subtle)]">—</span>}
                    </td>
                    <td />
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
