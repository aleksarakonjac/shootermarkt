"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// value format: "YYYY-MM-DDTHH:MM" or ""

interface Props {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}

const MONTHS = ["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"];
const DAYS   = ["Po","Ut","Sr","Če","Pe","Su","Ne"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function DateTimePicker({
  value, onChange, min, max, placeholder = "Izaberi datum i vreme…", className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef      = useRef<HTMLButtonElement>(null);
  const panelRef        = useRef<HTMLDivElement>(null);

  const datePart = value ? value.split("T")[0] : "";
  const timePart = value ? (value.split("T")[1] ?? "00:00") : "00:00";
  const [th, tm2] = timePart.split(":");

  const [hour, setHour] = useState(th  ?? "00");
  const [min2, setMin2] = useState(tm2 ?? "00");

  // Sync hour/min when external value changes
  useEffect(() => {
    const tp = value?.split("T")[1];
    if (tp) { const [hh, mm] = tp.split(":"); setHour(hh ?? "00"); setMin2(mm ?? "00"); }
  }, [value]);

  // Calendar view state
  const initDate  = datePart ? new Date(datePart + "T00:00:00") : new Date();
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  // Click-outside & scroll/resize tracking
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
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    // Reset view to selected date or today
    const base = datePart ? new Date(datePart + "T00:00:00") : new Date();
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
    const ds = toDateStr(viewYear, viewMonth, d);
    onChange(`${ds}T${hour.padStart(2, "0")}:${min2.padStart(2, "0")}`);
  }

  function handleHour(v: string) {
    const clamped = pad(Math.max(0, Math.min(23, parseInt(v, 10) || 0)));
    setHour(clamped);
    if (datePart) onChange(`${datePart}T${clamped}:${min2.padStart(2, "0")}`);
  }

  function handleMin(v: string) {
    const clamped = pad(Math.max(0, Math.min(59, parseInt(v, 10) || 0)));
    setMin2(clamped);
    if (datePart) onChange(`${datePart}T${hour.padStart(2, "0")}:${clamped}`);
  }

  // Calendar grid
  // Monday-first: getDay() 0=Sun→6, 1=Mon→0, 2=Tue→1, ..., 6=Sat→5
  const rawDow    = new Date(viewYear, viewMonth, 1).getDay();
  const firstDow  = rawDow === 0 ? 6 : rawDow - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr  = new Date().toISOString().split("T")[0];
  const minStr    = min ? min.split("T")[0] : null;
  const maxStr    = max ? max.split("T")[0] : null;

  function isDisabled(d: number) {
    const ds = toDateStr(viewYear, viewMonth, d);
    return (minStr != null && ds < minStr) || (maxStr != null && ds > maxStr);
  }

  // Display
  function fmtDisplay() {
    if (!value) return null;
    const [dp, tp] = value.split("T");
    if (!dp) return null;
    const [y, mo, d] = dp.split("-");
    return `${d}.${mo}.${y}. ${tp ?? ""}`;
  }

  const panelStyle: React.CSSProperties = rect
    ? { position: "fixed", top: rect.bottom + 4, left: rect.left, zIndex: 9999, minWidth: 264 }
    : { display: "none" };

  const display = fmtDisplay();

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="block w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-left focus:outline-none focus:border-[var(--brand-primary)] transition-colors flex items-center justify-between gap-2"
      >
        <span className={display ? "text-[var(--ink)]" : "text-[var(--subtle)]"}>
          {display ?? placeholder}
        </span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--muted)]" aria-hidden="true">
          <rect x="1" y="2.5" width="10" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M1 6h10" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M4 1v3M8 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div ref={panelRef} style={panelStyle} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden select-none">

          {/* Time */}
          <div className="px-3 py-2.5 border-b border-[var(--border)] flex items-center gap-2">
            <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--subtle)] shrink-0 w-10">Vreme</span>
            <input
              type="number" min={0} max={23}
              value={parseInt(hour, 10)}
              onChange={e => handleHour(e.target.value)}
              className="w-12 text-center rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[var(--muted)] font-bold">:</span>
            <input
              type="number" min={0} max={59} step={5}
              value={parseInt(min2, 10)}
              onChange={e => handleMin(e.target.value)}
              className="w-12 text-center rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {datePart && (
              <button type="button" onClick={() => setOpen(false)}
                className="ml-auto text-[0.65rem] font-semibold text-white bg-[var(--brand-primary)] px-2.5 py-1 rounded hover:opacity-90 transition-opacity">
                OK
              </button>
            )}
          </div>

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

          {/* Single grid: headers + empty cells + days */}
          <div className="grid grid-cols-7 gap-0.5 p-2">
            {/* Day headers */}
            {DAYS.map(d => (
              <div key={d} className="text-center text-[0.6rem] font-bold uppercase text-[var(--subtle)] py-1">{d}</div>
            ))}
            {/* Empty offset cells */}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {/* Day buttons */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds  = toDateStr(viewYear, viewMonth, day);
              const sel = datePart === ds;
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

        </div>,
        document.body
      )}
    </div>
  );
}
