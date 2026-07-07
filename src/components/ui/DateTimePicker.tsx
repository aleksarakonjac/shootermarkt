"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Calendar from "react-calendar";

// value format: "YYYY-MM-DDTHH:MM" or ""

interface Props {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function toIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIso(s: string) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function DateTimePicker({ value, onChange, min, max, placeholder = "Izaberi datum i vreme…", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef      = useRef<HTMLButtonElement>(null);
  const panelRef        = useRef<HTMLDivElement>(null);

  const datePart = value ? value.split("T")[0] : "";
  const timePart = value ? (value.split("T")[1] ?? "00:00") : "00:00";
  const [h, rawM] = timePart.split(":");
  const [hour, setHour]   = useState(h  ?? "00");
  const [min2, setMin2]   = useState(rawM ?? "00");

  // Sync hour/min when external value changes
  useEffect(() => {
    if (!value) return;
    const tp = value.split("T")[1];
    if (tp) { const [hh, mm] = tp.split(":"); setHour(hh ?? "00"); setMin2(mm ?? "00"); }
  }, [value]);

  const selectedDate = useMemo(() => parseIso(datePart), [datePart]);
  const minDate      = useMemo(() => parseIso(min?.split("T")[0] ?? ""), [min]);
  const maxDate      = useMemo(() => parseIso(max?.split("T")[0] ?? ""), [max]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node) || panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function update() { setRect(triggerRef.current?.getBoundingClientRect() ?? null); }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);

  function emitChange(newDate: string, newH: string, newM: string) {
    if (!newDate) return;
    onChange(`${newDate}T${newH.padStart(2, "0")}:${newM.padStart(2, "0")}`);
  }

  function handleDateSelect(next: unknown) {
    const date = next instanceof Date ? next : Array.isArray(next) ? next[0] : null;
    if (!date) return;
    emitChange(toIso(date), hour, min2);
  }

  function handleHour(v: string) {
    const clamped = String(Math.max(0, Math.min(23, parseInt(v, 10) || 0))).padStart(2, "0");
    setHour(clamped);
    emitChange(datePart, clamped, min2);
  }

  function handleMin(v: string) {
    const clamped = String(Math.max(0, Math.min(59, parseInt(v, 10) || 0))).padStart(2, "0");
    setMin2(clamped);
    emitChange(datePart, hour, clamped);
  }

  function fmtDisplay() {
    if (!value) return null;
    const [dp, tp] = value.split("T");
    if (!dp) return null;
    const [y, mo, d] = dp.split("-");
    return `${d}.${mo}.${y}. ${tp ?? ""}`;
  }

  const display = fmtDisplay();

  const panelStyle: React.CSSProperties = rect
    ? { position: "fixed", top: rect.bottom + 4, left: rect.left, zIndex: 9999, minWidth: 260 }
    : { display: "none" };

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setRect(triggerRef.current?.getBoundingClientRect() ?? null); setOpen(v => !v); }}
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
        <div ref={panelRef} style={panelStyle} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg overflow-hidden">
          {/* Time row at top */}
          <div className="px-3 py-2.5 border-b border-[var(--border)] flex items-center gap-2">
            <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--subtle)] shrink-0 w-10">Vreme</span>
            <input
              type="number" min={0} max={23}
              value={parseInt(hour, 10)}
              onChange={e => handleHour(e.target.value)}
              className="w-12 text-center rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[var(--muted)] font-bold text-sm">:</span>
            <input
              type="number" min={0} max={59} step={5}
              value={parseInt(min2, 10)}
              onChange={e => handleMin(e.target.value)}
              className="w-12 text-center rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {datePart && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto text-[0.65rem] font-semibold text-white bg-[var(--brand-primary)] px-2.5 py-1 rounded hover:opacity-90 transition-opacity"
              >
                OK
              </button>
            )}
          </div>

          {/* Calendar — react-calendar handles day alignment correctly */}
          <div className="p-2">
            <Calendar
              value={selectedDate}
              onChange={handleDateSelect}
              minDate={minDate ?? undefined}
              maxDate={maxDate ?? undefined}
              locale="sr-Latn-RS"
              next2Label={null}
              prev2Label={null}
              showNeighboringMonth={false}
              className="shootermarkt-calendar"
              formatDay={(_, date) => String(date.getDate())}
              formatMonthYear={(_, date) =>
                `${date.toLocaleString("sr-Latn-RS", { month: "long" })} ${date.getFullYear()}`
              }
              tileClassName={({ date, view }) => {
                if (view !== "month") return undefined;
                if (selectedDate && isSameDay(date, selectedDate)) return "shootermarkt-calendar__tile--selected";
                return undefined;
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
