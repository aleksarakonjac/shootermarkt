import { DISCIPLINE_META, type DisciplineCode } from "@shootermarkt/db/pdf-import-types";
import { NocFlag } from "./ReviewTable";

export interface MixedTeamEntry {
  skip: boolean;
  nocCode: string;
  teamNumber: number;
  disciplineCode: DisciplineCode;
  qualRank: number | null;
  qualTotal: number | null;
  inners: number | null;
  qualRemark?: string | null;
  qualified: boolean;
  finalRank: number | null;
  finalTotal: number | null;
  finalRemark?: string | null;
  mIssfId: string | null;
  mLastName: string;
  mFirstName: string;
  m_series: number[];
  mInners: number | null;
  mTotal: number;
  fIssfId: string | null;
  fLastName: string;
  fFirstName: string;
  f_series: number[];
  fInners: number | null;
  fTotal: number;
  mFinalSeries?: number[];
  fFinalSeries?: number[];
}

const stickyHeader = "sticky z-20 bg-[var(--surface)]";
const stickyCell = "sticky z-10 bg-[var(--bg)]";
const stickyDivider = "border-l-2 border-[var(--border-strong)] [box-shadow:-8px_0_12px_-6px_rgba(0,0,0,0.12)]";

// ARMT qual/final decimal; APMT qual integer + inners, final decimal.
const isQualDecimal = (code: string) => code.startsWith("AR");
const fmtScore = (v: number, code: string) => (isQualDecimal(code) ? v.toFixed(1) : String(Math.round(v)));
const fmtFinal = (v: number) => v.toFixed(1);

function TeamLabel({ nocCode, teamNumber, showNumber }: { nocCode: string; teamNumber: number; showNumber: boolean }) {
  return (
    <span className="flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--muted)]">
      <NocFlag noc={nocCode} />
      {nocCode}
      {showNumber && <span className="text-[var(--subtle)]">{teamNumber}</span>}
    </span>
  );
}

/** Qual review — one table per discipline (ARMT / APMT never mixed), each
 *  team shown as 2 rows (one per shooter) with a shared rowSpan team total. */
export function MixedTeamQualTable({
  entries,
  onToggleSkip,
}: {
  entries: MixedTeamEntry[];
  onToggleSkip: (index: number) => void;
}) {
  const byDiscipline = Array.from(new Set(entries.map((e) => e.disciplineCode)));
  const seriesCount = 3;

  return (
    <div className="space-y-5">
      {byDiscipline.map((discipline) => {
        const discEntries = entries.flatMap((e, index) => (e.disciplineCode === discipline ? [{ e, index }] : []));
        const hasInners = discipline === "APMT";
        const nocCounts = new Map<string, number>();
        for (const { e } of discEntries) nocCounts.set(e.nocCode, (nocCounts.get(e.nocCode) ?? 0) + 1);

        return (
          <section key={discipline} className="overflow-hidden rounded-lg border border-[var(--border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--ink)]">{DISCIPLINE_META[discipline]?.label ?? discipline}</h3>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{discEntries.length} kvalifikacija</span>
            </div>
            <div className="overflow-x-auto border-t border-[var(--border)]">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                    <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
                    <th className="px-3 py-2.5 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                    {Array.from({ length: seriesCount }, (_, i) => (
                      <th key={i} className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">S{i + 1}</th>
                    ))}
                    {hasInners && <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inner tens</th>}
                    <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ukupno</th>
                    <th className={`${stickyHeader} ${stickyDivider} right-0 w-24 px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Tim ukupno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {discEntries.flatMap(({ e, index }) => [
                    <tr key={`${index}-m`} className={e.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}>
                      <td rowSpan={2} className="px-3 py-2 text-right align-middle font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{e.qualRank ?? "—"}</td>
                      <td rowSpan={2} className="px-3 py-2 text-center align-middle"><input type="checkbox" checked={e.skip} onChange={() => onToggleSkip(index)} className="accent-[var(--brand-primary)]" /></td>
                      <td rowSpan={2} className="px-3 py-2 align-middle"><TeamLabel nocCode={e.nocCode} teamNumber={e.teamNumber} showNumber={(nocCounts.get(e.nocCode) ?? 0) > 1} /></td>
                      <td className="px-3 py-2 font-medium text-[var(--ink)] whitespace-nowrap">{e.mLastName} {e.mFirstName}</td>
                      {Array.from({ length: seriesCount }, (_, s) => (
                        <td key={s} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{e.m_series[s] != null ? fmtScore(e.m_series[s], discipline) : "—"}</td>
                      ))}
                      {hasInners && <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{e.mInners != null ? `${e.mInners}×` : "—"}</td>}
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)]">{e.mTotal ? fmtScore(e.mTotal, discipline) : "—"}</td>
                      <td rowSpan={2} className={`${stickyCell} ${stickyDivider} right-0 w-24 px-3 py-2 text-right align-middle font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)]`}>{e.qualTotal != null ? fmtScore(e.qualTotal, discipline) : "—"}</td>
                    </tr>,
                    <tr key={`${index}-f`} className={e.skip ? "border-t border-[var(--border)] opacity-40" : "border-t border-[var(--border)] hover:bg-[var(--surface)]"}>
                      <td className="px-3 py-2 font-medium text-[var(--ink)] whitespace-nowrap">{e.fLastName} {e.fFirstName}</td>
                      {Array.from({ length: seriesCount }, (_, s) => (
                        <td key={s} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{e.f_series[s] != null ? fmtScore(e.f_series[s], discipline) : "—"}</td>
                      ))}
                      {hasInners && <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{e.fInners != null ? `${e.fInners}×` : "—"}</td>}
                      <td className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)]">{e.fTotal ? fmtScore(e.fTotal, discipline) : "—"}</td>
                    </tr>,
                  ])}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Finals review — one table per discipline, teams shown as 2 rows each. */
export function MixedTeamFinalsTable({
  entries,
  onToggleSkip,
}: {
  entries: MixedTeamEntry[];
  onToggleSkip: (index: number) => void;
}) {
  const finalists = entries.flatMap((e, index) => (e.finalRank != null ? [{ e, index }] : []));
  if (finalists.length === 0) return null;

  const byDiscipline = Array.from(new Set(finalists.map(({ e }) => e.disciplineCode)));

  return (
    <div className="space-y-5">
      {byDiscipline.map((discipline) => {
        const discFinalists = [...finalists.filter(({ e }) => e.disciplineCode === discipline)]
          .sort((a, b) => (a.e.finalRank ?? 99) - (b.e.finalRank ?? 99));
        const seriesCount = Math.max(0, ...discFinalists.flatMap(({ e }) => [e.mFinalSeries?.length ?? 0, e.fFinalSeries?.length ?? 0]));
        const nocCounts = new Map<string, number>();
        for (const { e } of discFinalists) nocCounts.set(e.nocCode, (nocCounts.get(e.nocCode) ?? 0) + 1);

        return (
          <section key={discipline} className="overflow-hidden rounded-lg border border-[var(--border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--ink)]">{DISCIPLINE_META[discipline]?.label ?? discipline} · Finale</h3>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{discFinalists.length} timova</span>
            </div>
            <div className="overflow-x-auto border-t border-[var(--border)]">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                    <th className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
                    <th className="px-3 py-2.5 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Skip</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                    {Array.from({ length: seriesCount }, (_, i) => (
                      <th key={i} className="px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">S{i + 1}</th>
                    ))}
                    <th className={`${stickyHeader} ${stickyDivider} right-0 w-28 px-3 py-2.5 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]`}>Tim ukupno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {discFinalists.flatMap(({ e, index }) => [
                    <tr key={`${index}-m`} className={e.skip ? "opacity-40" : "hover:bg-[var(--surface)]"}>
                      <td rowSpan={2} className="px-3 py-2 text-right align-middle font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{e.finalRank}</td>
                      <td rowSpan={2} className="px-3 py-2 text-center align-middle"><input type="checkbox" checked={e.skip} onChange={() => onToggleSkip(index)} className="accent-[var(--brand-primary)]" /></td>
                      <td rowSpan={2} className="px-3 py-2 align-middle"><TeamLabel nocCode={e.nocCode} teamNumber={e.teamNumber} showNumber={(nocCounts.get(e.nocCode) ?? 0) > 1} /></td>
                      <td className="px-3 py-2 font-medium text-[var(--ink)] whitespace-nowrap">{e.mLastName} {e.mFirstName}</td>
                      {Array.from({ length: seriesCount }, (_, s) => (
                        <td key={s} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{e.mFinalSeries?.[s] != null ? fmtFinal(e.mFinalSeries[s]) : "—"}</td>
                      ))}
                      <td rowSpan={2} className={`${stickyCell} ${stickyDivider} right-0 w-28 px-3 py-2 text-right align-middle font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold text-[var(--ink)]`}>{e.finalTotal != null ? fmtFinal(e.finalTotal) : "—"}</td>
                    </tr>,
                    <tr key={`${index}-f`} className={e.skip ? "border-t border-[var(--border)] opacity-40" : "border-t border-[var(--border)] hover:bg-[var(--surface)]"}>
                      <td className="px-3 py-2 font-medium text-[var(--ink)] whitespace-nowrap">{e.fLastName} {e.fFirstName}</td>
                      {Array.from({ length: seriesCount }, (_, s) => (
                        <td key={s} className="px-3 py-2 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">{e.fFinalSeries?.[s] != null ? fmtFinal(e.fFinalSeries[s]) : "—"}</td>
                      ))}
                    </tr>,
                  ])}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
