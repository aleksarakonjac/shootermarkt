"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const MONTHS = ["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"];
const DAYS   = ["Po","Ut","Sr","Če","Pe","Su","Ne"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseIso(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const [ys, ms, ds] = value.split("-");
  const y = parseInt(ys, 10), m = parseInt(ms, 10) - 1, d = parseInt(ds, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { y, m, d };
}

function fmtDisplay(value: string) {
  const p = parseIso(value);
  if (!p) return "";
  return `${pad(p.d)}.${pad(p.m + 1)}.${p.y}.`;
}

export function DatePicker({
  value, onChange, min, max, required = false, placeholder = "Izaberi datum…", disabled = false, className = "",
}: Props) {
  const [open, setOpen]   = useState(false);
  const [rect, setRect]   = useState<DOMRect | null>(null);
  const triggerRef        = useRef<HTMLButtonElement>(null);
  const panelRef          = useRef<HTMLDivElement>(null);

  const parsed = parseIso(value);
  const initDate = parsed ? new Date(parsed.y, parsed.m, parsed.d) : new Date();
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function update() { setRect(triggerRef.current?.getBoundingClientRect() ?? null); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  function openPicker() {
    if (disabled) return;
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    const base = parsed ? new Date(parsed.y, parsed.m, parsed.d) : new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(d: number) {
    onChange(toIso(viewYear, viewMonth, d));
    setOpen(false);
  }

  const rawDow     = new Date(viewYear, viewMonth, 1).getDay();
  const firstDow   = rawDow === 0 ? 6 : rawDow - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr   = new Date().toISOString().split("T")[0];
  const minStr     = min ?? null;
  const maxStr     = max ?? null;

  function isDisabled(d: number) {
    const ds = toIso(viewYear, viewMonth, d);
    return (minStr != null && ds < minStr) || (maxStr != null && ds > maxStr);
  }

  const panelStyle: React.CSSProperties = rect
    ? { position: "fixed", top: rect.bottom + 4, left: rect.left, zIndex: 9999, minWidth: 264 }
    : { display: "none" };

  const display = fmtDisplay(value);

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile: native date input */}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="md:hidden w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      />

      {/* Desktop: custom picker */}
      <div className="hidden md:block">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={openPicker}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${display ? "text-[var(--ink)]" : "text-[var(--subtle)]"}`}
        >
          <span>{display || placeholder}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
            <rect x="1" y="2.5" width="10" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M1 6h10" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M4 1v3M8 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {open && typeof window !== "undefined" && createPortal(
          <div ref={panelRef} style={panelStyle} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden select-none">

            {/* Month nav */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
              <button type="button" onClick={prevMonth}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors p-1 rounded hover:bg-[var(--surface-2)]">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 3L5 6.5l3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="text-xs font-semibold text-[var(--ink)]">{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors p-1 rounded hover:bg-[var(--surface-2)]">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 3l3 3.5-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {/* Single grid */}
            <div className="grid grid-cols-7 gap-0.5 p-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[0.6rem] font-bold uppercase text-[var(--subtle)] py-1">{d}</div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const ds  = toIso(viewYear, viewMonth, day);
                const sel = value === ds;
                const dis = isDisabled(day);
                const tod = ds === todayStr;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={dis}
                    onClick={() => selectDay(day)}
                    className={[
                      "w-full aspect-square flex items-center justify-center rounded text-xs transition-colors",
                      dis ? "text-[var(--border-strong)] cursor-not-allowed" : "cursor-pointer",
                      sel ? "bg-[var(--brand-primary)] text-white font-bold" : "",
                      tod && !sel ? "font-bold text-[var(--brand-primary)]" : "",
                      !sel && !dis ? "hover:bg-[var(--surface-2)] text-[var(--ink)]" : "",
                    ].join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2">
              <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">
                Obriši
              </button>
              <button type="button" onClick={() => selectDay(new Date().getDate())}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--surface)] transition-colors">
                Danas
              </button>
            </div>

          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
