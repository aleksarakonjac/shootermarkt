"use client";

import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Red koji se širi i skuplja uz animaciju visine (grid-template-rows 0fr ↔ 1fr, bez merenja u JS-u).
 * Sadržaj stiže renderovan sa servera. `group-data-[open=true]:` na deci zaglavlja se koristi za strelicu.
 */
export function Disclosure({ summary, children, defaultOpen = false, summaryClassName, summaryStyle, footer, closeLabel }: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  summaryClassName?: string;
  summaryStyle?: CSSProperties;
  /** Levo dole u otvorenom redu; uz closeLabel desno dole stoji dugme za zatvaranje. */
  footer?: ReactNode;
  closeLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Zatvaranje donjim dugmetom: donja ivica reda ostaje na mestu na ekranu, pa se red skuplja
  // "ka dole" — zaglavlje klizi ka dugmetu dok scroll prati visinu koja nestaje.
  function closeFollowingScroll() {
    const el = rootRef.current;
    setOpen(false);
    if (!el) return;
    const bottom = el.getBoundingClientRect().bottom;
    const end = performance.now() + 400;
    const step = () => {
      const delta = el.getBoundingClientRect().bottom - bottom;
      if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
      if (performance.now() < end) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  return (
    <div className="group" data-open={open} ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)] ${summaryClassName ?? ""}`}
        style={summaryStyle}
      >
        {summary}
      </button>
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        {/* inert: skupljen sadržaj ne prima fokus ni klikove. */}
        <div className={`min-h-0 overflow-hidden transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`} inert={!open}>
          {children}
          {closeLabel && (
            <div className="flex items-center justify-between gap-4 bg-[var(--surface)] px-4 pb-4">
              <div>{footer}</div>
              <button type="button" onClick={closeFollowingScroll} className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]">
                {closeLabel}
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 9L7 4.5L11.5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
