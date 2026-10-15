"use client";

import { FOCUS_300M_OFFSET, FOCUS_AGE_OFFSET, FOCUS_PRIORITY_MAX, FOCUS_PRIORITY_MIN, FOCUS_PRIORITY_TIERS } from "@/lib/competition-priority";

const AGE_ROWS: Array<[string, string]> = [["senior", "Senior"], ["junior", "Junior"], ["mladji_junior", "Mlađi junior (U18)"], ["kadet", "Kadet"], ["pionir", "Pionir"]];

/**
 * Ručni prioritet za "In focus" sekciju (manji broj = važnije). Prazno = auto.
 * `autoValue` je podrazumevana vrednost koju bi takmičenje dobilo bez override-a.
 */
export function FocusPriorityField({ value, onChange, autoValue }: { value: string; onChange: (value: string) => void; autoValue: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Prioritet (In focus)</label>
      <input
        type="number"
        inputMode="numeric"
        min={FOCUS_PRIORITY_MIN}
        max={FOCUS_PRIORITY_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Auto (${autoValue})`}
        className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
      />
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        Manji broj = važnije (0 je vrh). Prazno = automatski ({autoValue}, računa se iz nivoa, imena i kategorija iz rasporeda/rezultata).
      </p>
      <details className="mt-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer font-semibold text-[var(--ink)]">Legenda prioriteta</summary>
        <ul className="mt-2 space-y-1">
          {FOCUS_PRIORITY_TIERS.map((tier) => (
            <li key={tier.value}>
              <span className="inline-block w-6 font-bold tabular-nums text-[var(--ink)]">{tier.value}</span>
              {tier.label} <span className="text-[var(--subtle)]">— {tier.examples}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Auto dodaje pomak za kategoriju:{" "}
          {AGE_ROWS.map(([key, label]) => `${label} +${FOCUS_AGE_OFFSET[key]}`).join(", ")}; i +{FOCUS_300M_OFFSET} za 300m.
          Primer: juniorsko evropsko prvenstvo = 3 + 2 = 5; European Youth League finale (U18) postavi ručno na 8.
        </p>
      </details>
    </div>
  );
}
