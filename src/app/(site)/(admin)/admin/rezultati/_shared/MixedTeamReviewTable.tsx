export interface MixedTeamEntry {
  skip: boolean;
  nocCode: string;
  teamNumber: number;
  disciplineCode: string;
  qualRank: number | null;
  qualTotal: number | null;
  inners: number | null;
  qualified: boolean;
  finalRank: number | null;
  finalTotal: number | null;
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
}

const DISC_LABELS: Record<string, string> = {
  APMT: "10m AP Mešoviti tim",
  ARMT: "10m VP Mešoviti tim",
};

export function MixedTeamReviewTable({
  entries,
  onToggleSkip,
}: {
  entries: MixedTeamEntry[];
  onToggleSkip: (index: number) => void;
}) {
  // Nation appears more than once (2 teams entered) — show the team number
  // next to NOC so the rows are distinguishable in the table.
  const nocCounts = new Map<string, number>();
  for (const e of entries) nocCounts.set(e.nocCode, (nocCounts.get(e.nocCode) ?? 0) + 1);

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
          <tr>
            <th className="px-3 py-2 text-left text-[var(--muted)] font-semibold">Disciplina</th>
            <th className="px-3 py-2 text-left text-[var(--muted)] font-semibold">Tim</th>
            <th className="px-3 py-2 text-left text-[var(--muted)] font-semibold">Rang Q</th>
            <th className="px-3 py-2 text-left text-[var(--muted)] font-semibold">Ukupno</th>
            <th className="px-3 py-2 text-left text-[var(--muted)] font-semibold">Strelac 1</th>
            <th className="px-3 py-2 text-left text-[var(--muted)] font-semibold">Strelac 2</th>
            <th className="px-3 py-2 text-left text-[var(--muted)] font-semibold">Finale</th>
            <th className="px-3 py-2 text-center text-[var(--muted)] font-semibold">Preskoči</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {entries.map((e, i) => (
            <tr
              key={i}
              className="transition-colors"
              style={{ background: e.skip ? "var(--surface)" : undefined, opacity: e.skip ? 0.5 : 1 }}
            >
              <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--brand-primary)" }}>
                {e.disciplineCode}
                <span className="ml-1 font-normal text-[var(--muted)]">{DISC_LABELS[e.disciplineCode] ?? ""}</span>
              </td>
              <td className="px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">
                {e.nocCode}
                {(nocCounts.get(e.nocCode) ?? 0) > 1 && (
                  <span className="ml-1 text-[var(--muted)] font-normal">{e.teamNumber}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-[var(--muted)]">
                {e.qualRank != null ? `#${e.qualRank}` : "—"}
                {e.qualified && <span className="ml-1 text-[0.6rem] px-1 rounded" style={{ background: "var(--brand-primary)", color: "white" }}>Q</span>}
              </td>
              <td className="px-3 py-2.5 font-semibold text-[var(--ink)]">
                {e.qualTotal ?? "—"}
                {e.inners != null && <span className="ml-1 text-[var(--muted)]">{e.inners}x</span>}
              </td>
              <td className="px-3 py-2.5 text-[var(--ink)]">
                {e.mLastName ? `${e.mLastName} ${e.mFirstName}`.trim() : <span className="text-[var(--subtle)]">—</span>}
                {e.mTotal > 0 && <span className="ml-1 text-[var(--muted)]">({e.mTotal})</span>}
              </td>
              <td className="px-3 py-2.5 text-[var(--ink)]">
                {e.fLastName ? `${e.fLastName} ${e.fFirstName}`.trim() : <span className="text-[var(--subtle)]">—</span>}
                {e.fTotal > 0 && <span className="ml-1 text-[var(--muted)]">({e.fTotal})</span>}
              </td>
              <td className="px-3 py-2.5 text-[var(--muted)]">
                {e.finalRank != null ? `#${e.finalRank} · ${e.finalTotal ?? ""}` : "—"}
              </td>
              <td className="px-3 py-2.5 text-center">
                <button
                  onClick={() => onToggleSkip(i)}
                  className="rounded px-2 py-0.5 text-[0.65rem] font-semibold border border-[var(--border)] transition-colors hover:bg-[var(--surface)]"
                  style={{ color: e.skip ? "var(--brand-primary)" : "var(--muted)" }}
                >
                  {e.skip ? "Uključi" : "Preskoči"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
