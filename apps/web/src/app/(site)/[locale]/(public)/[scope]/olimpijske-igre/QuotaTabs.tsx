"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type Tab = { id: string; label: string; count?: number };

/**
 * Prekidač prikaza (po takmičenjima / disciplinama / državama). Sav sadržaj stiže renderovan sa servera;
 * ovde se samo menja koji je panel vidljiv, pa stranica ostaje statična (bez ?tab= u URL-u).
 */
export function QuotaTabs({ tabs, panels, label }: { tabs: Tab[]; panels: Record<string, ReactNode>; label: string }) {
  const [active, setActive] = useState(tabs[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === active);
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : null;
    if (next == null) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              role="tab"
              id={`quota-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`quota-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => setActive(t.id)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${selected ? "bg-[var(--bg)] text-[var(--ink)] shadow-sm ring-1 ring-[var(--border)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
            >
              {t.label}
              {t.count != null && <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-normal tabular-nums text-[var(--muted)]">{t.count}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`quota-panel-${t.id}`} aria-labelledby={`quota-tab-${t.id}`} hidden={t.id !== active}>
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
