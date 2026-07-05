"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";

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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIso(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplay(value: string) {
  const date = parseIso(value);
  if (!date) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function parseDisplay(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return toIso(date);
}

function formatCalendarDay(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  required = false,
  placeholder = "dd/mm/yyyy",
  disabled = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? formatDisplay(value) : "");
  const ref = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => parseIso(value), [value]);
  const minDate = useMemo(() => parseIso(min ?? ""), [min]);
  const maxDate = useMemo(() => parseIso(max ?? ""), [max]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDraft(value ? formatDisplay(value) : "");
    }
  }, [open, value]);

  function commit(next: string) {
    onChange(next);
    setDraft(next ? formatDisplay(next) : "");
    setOpen(false);
  }

  function handleDraftChange(next: string) {
    setDraft(next);
    const iso = parseDisplay(next);
    if (iso) {
      onChange(iso);
    } else if (next.trim() === "") {
      onChange("");
    }
  }

  function handleBlur() {
    if (!draft.trim()) {
      onChange("");
      setDraft("");
      return;
    }

    const iso = parseDisplay(draft);
    if (iso) {
      onChange(iso);
      setDraft(formatDisplay(iso));
    } else {
      setDraft(value ? formatDisplay(value) : "");
    }
  }

  function handleSelect(next: unknown) {
    const date = next instanceof Date ? next : Array.isArray(next) ? next[0] : null;
    if (!date) return;
    commit(toIso(date));
  }

  const currentLabel = value ? formatDisplay(value) : placeholder;

  return (
    <div className={`w-full ${className}`} ref={ref}>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="md:hidden w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="relative hidden md:block">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={value ? "text-[var(--ink)]" : "text-[var(--subtle)]"}>
            {currentLabel}
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5 shadow-lg">
            <div className="mb-2">
              <input
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder}
                inputMode="numeric"
                autoComplete="off"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>

            <Calendar
              value={selectedDate}
              onChange={handleSelect}
              minDate={minDate ?? undefined}
              maxDate={maxDate ?? undefined}
              locale="sr-Latn-RS"
              next2Label={null}
              prev2Label={null}
              showNeighboringMonth={false}
              className="shootermarkt-calendar"
              formatDay={(_, date) => String(date.getDate())}
              formatMonthYear={(_, date) => `${date.toLocaleString("sr-Latn-RS", { month: "long" })} ${date.getFullYear()}`}
              tileClassName={({ date, view }) => {
                if (view !== "month") return undefined;
                if (selectedDate && isSameDay(date, selectedDate)) return "shootermarkt-calendar__tile--selected";
                return undefined;
              }}
            />

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
              <button
                type="button"
                onClick={() => commit("")}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
              >
                Obriši
              </button>
              <button
                type="button"
                onClick={() => commit(toIso(new Date()))}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--surface)] transition-colors"
              >
                Danas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}