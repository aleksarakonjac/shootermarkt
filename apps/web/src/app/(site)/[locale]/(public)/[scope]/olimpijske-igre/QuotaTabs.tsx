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
      {/* Tabovi izgledaju kao podnaslovi stranice (Barlow Condensed, velika slova); izabrani je podvučen. */}
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="mb-6 flex gap-x-4 overflow-x-auto overflow-y-hidden sm:gap-x-6 border-b border-[var(--border)] [scrollbar-width:none]">
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
              className={`relative flex shrink-0 items-baseline gap-2 pb-2.5 font-[family-name:var(--font-barlow-condensed)] font-bold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] text-lg sm:text-2xl ${selected ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
              style={{ letterSpacing: "-0.02em" }}
            >
              {t.label}
              {t.count != null && <span className="hidden font-[family-name:var(--font-jetbrains-mono)] text-sm font-normal normal-case tabular-nums text-[var(--muted)] sm:inline" style={{ letterSpacing: 0 }}>{t.count}</span>}
              {selected && (
                <motion.span
                  layoutId="quota-tab-underline"
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1 bg-[var(--brand-primary)]"
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
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
