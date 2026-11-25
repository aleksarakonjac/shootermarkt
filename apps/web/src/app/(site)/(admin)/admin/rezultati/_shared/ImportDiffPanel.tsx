import type { ImportDiff } from "@/lib/import-diff";

export const diffToWrite = (d: ImportDiff) => d.added + d.changed;

/** "Novo X · izmenjeno Y · već uneto Z" + spisak onoga što bi uvoz upisao. */
export function ImportDiffPanel({ diff, edited }: { diff: ImportDiff; edited?: boolean }) {
  const nothing = diffToWrite(diff) === 0;
  return (
    <div
      role="status"
      className="rounded-lg border px-4 py-3 text-sm space-y-2"
      style={{ borderColor: nothing ? "var(--success)" : "var(--border-strong)" }}
    >
      <p className="font-semibold" style={{ color: nothing ? "var(--success)" : "var(--ink)" }}>
        {nothing
          ? `Sve je već uneto (${diff.same}) — nema razlike, uvoz nije potreban.`
          : `Novo: ${diff.added} · izmenjeno: ${diff.changed} · već uneto bez razlike: ${diff.same}`}
      </p>
      {edited && <p className="text-xs text-[var(--muted)]">Brojevi važe za podatke sa SIUS-a, pre tvojih izmena. Pri unosu se nepromenjeni redovi preskaču.</p>}
      {!nothing && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-primary)]">Šta je novo / izmenjeno</summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs text-[var(--ink)]">
            {diff.items.map((item, i) => (
              <li key={i}>
                <span className="font-semibold" style={{ color: item.status === "new" ? "var(--success)" : "var(--warning)" }}>
                  {item.status === "new" ? "NOVO" : "IZMENA"}
                </span>{" "}
                {item.label}
                {item.changes.length > 0 && <span className="text-[var(--muted)]"> — {item.changes.join(", ")}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
