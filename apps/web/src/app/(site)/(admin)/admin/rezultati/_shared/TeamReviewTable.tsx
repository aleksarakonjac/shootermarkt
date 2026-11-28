import { CATEGORY_LABEL, type TeamResultEntry } from "@shootermarkt/db/pdf-import-types";

/** Klupske ekipe iz biltena, samo za čitanje: admin može samo da preskoči ekipu. */
export function TeamReviewTable({ entries, onToggleSkip }: { entries: TeamResultEntry[]; onToggleSkip: (index: number) => void }) {
  const groups = new Map<string, number[]>();
  entries.forEach((e, i) => {
    const key = [e.disciplineCode, CATEGORY_LABEL[e.category], e.eventName].filter(Boolean).join(" · ");
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  return (
    <div className="space-y-3">
      {[...groups].map(([label, indexes]) => (
        <div key={label} className="overflow-hidden rounded-xl border border-[var(--border)]">
          <p className="bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
          <ul className="divide-y divide-[var(--border)]">
            {indexes.map((index) => {
              const e = entries[index];
              return (
                <li key={index} className={`flex flex-wrap items-start gap-3 px-4 py-2.5 text-sm ${e.skip ? "opacity-40" : ""}`}>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    <input type="checkbox" checked={e.skip} onChange={() => onToggleSkip(index)} aria-label={`Preskoči ekipu ${e.teamName}`} className="accent-[var(--brand-primary)]" />
                    preskoči
                  </label>
                  <span className="w-8 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)]">{e.rank ?? e.remark ?? "—"}</span>
                  <div className="min-w-[220px] flex-1">
                    <span className="font-semibold text-[var(--ink)]">{e.teamName}</span>
                    <ul className="text-xs text-[var(--muted)]">
                      {e.members.map((m, i) => (
                        <li key={i}>{m.lastName} {m.firstName} · {m.total}{m.isNew && <span className="ml-1.5 font-semibold" style={{ color: "var(--warning)" }}>novi</span>}</li>
                      ))}
                    </ul>
                  </div>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">{e.total ?? "—"}{e.inners != null && ` ${e.inners}×`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
