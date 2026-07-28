"use client";

import { useEffect, useId, useRef, useState } from "react";

export const DISCIPLINE_COLOR: Record<string, string> = {
  ARM: "#C20000",
  ARW: "#1d4ed8",
  APM: "#15803d",
  APW: "#7e22ce",
};

type Option = { code: string; label?: string };

export function DisciplineSelector({
  options,
  value,
  onChange,
  locale = "sr",
  showLabel = false,
}: {
  options: Option[];
  value: string;
  onChange: (code: string) => void;
  locale?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.code === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={locale === "en" ? "Select discipline" : "Izaberi disciplinu"}
        className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[14px] font-extrabold tracking-wider uppercase transition-colors font-[family-name:var(--font-barlow-condensed)] ${
          showLabel ? "max-w-full bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--border)]" : "text-white"
        }`}
        style={showLabel ? undefined : { background: DISCIPLINE_COLOR[selected.code] ?? "#C20000" }}
      >
        {showLabel && (
          <span className="rounded px-1.5 py-px text-white" style={{ background: DISCIPLINE_COLOR[selected.code] ?? "#C20000" }}>
            {selected.code}
          </span>
        )}
        <span className={showLabel ? "truncate" : undefined}>{showLabel ? selected.label : selected.code}</span>
        <svg width="9" height="9" viewBox="0 0 9 9" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <ul id={listboxId} role="listbox" className="absolute left-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] min-w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] py-1 shadow-[0_4px_12px_oklch(0_0_0/0.12)]">
          {options.map((option) => (
            <li key={option.code} role="option" aria-selected={value === option.code}>
              <button
                type="button"
                onClick={() => { onChange(option.code); setOpen(false); }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DISCIPLINE_COLOR[option.code] ?? "#C20000" }} aria-hidden="true" />
                <span className="whitespace-nowrap">{showLabel ? option.label : option.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
