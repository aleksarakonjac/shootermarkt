"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Tab = { id: string; label: string; count?: number };

/**
 * Prekidač prikaza (po disciplinama / državama). Sadržaj stiže renderovan sa servera; aktivni panel ulazi uz kratku
 * animaciju, a oznaka izabranog taba klizi. Bez ?tab= u URL-u, da stranica ostane statična.
 */
export function QuotaTabs({ tabs, panels, label }: { tabs: Tab[]; panels: Record<string, ReactNode>; label: string }) {
  const [active, setActive] = useState(tabs[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduced = useReducedMotion();

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
              className={`relative flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] ${selected ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
            >
              {selected && (
                <motion.span
                  layoutId="quota-tab-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-[var(--bg)] shadow-sm ring-1 ring-[var(--border)]"
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{t.label}</span>
              {t.count != null && <span className="relative font-[family-name:var(--font-jetbrains-mono)] text-xs font-normal tabular-nums text-[var(--muted)]">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active}
          role="tabpanel"
          id={`quota-panel-${active}`}
          aria-labelledby={`quota-tab-${active}`}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {panels[active]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
