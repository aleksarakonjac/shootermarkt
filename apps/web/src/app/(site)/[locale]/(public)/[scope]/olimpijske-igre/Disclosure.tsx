"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Red koji se širi i skuplja uz animaciju visine (grid-template-rows 0fr ↔ 1fr, bez merenja u JS-u).
 * Sadržaj stiže renderovan sa servera. `group-data-[open=true]:` na deci zaglavlja se koristi za strelicu.
 */
export function Disclosure({ summary, children, defaultOpen = false, summaryClassName, summaryStyle }: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  summaryClassName?: string;
  summaryStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="group" data-open={open}>
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
        </div>
      </div>
    </div>
  );
}
