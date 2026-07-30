"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type Range = { from: string; to: string };
type Mode = "days" | "months" | "years";

type Props = {
  value: Range;
  onApply: (range: Range) => void;
  locale: string;
  labels: { date: string; days: string; months: string; years: string; clear: string; apply: string };
};

const MONTHS = {
  sr: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatRange(range: Range, fallback: string) {
  if (!range.from && !range.to) return fallback;
  const format = (value: string) => value ? value.split("-").reverse().join(".") : "…";
  return `${format(range.from)} – ${format(range.to)}`;
}

export function ResultsDateRangePicker({ value, onApply, locale, labels }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("days");
  const [jump, setJump] = useState<"months" | "years" | null>(null);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [draft, setDraft] = useState<Range>(value);
  const monthNames = MONTHS[locale === "en" ? "en" : "sr"];

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function openPicker() {
    const initial = value.from ? new Date(`${value.from}T12:00:00`) : now;
    setViewYear(initial.getFullYear());
    setViewMonth(initial.getMonth());
    setDraft(value);
    setOpen(true);
  }

  function pick(from: string, to = from) {
    setDraft((current) => {
      if (!current.from || current.to) return { from, to: "" };
      return from < current.from ? { from, to: current.from } : { from: current.from, to };
    });
  }

  function previous() {
    const activeMode = jump ?? mode;
    if (activeMode === "years") setViewYear((year) => year - 12);
    else if (activeMode === "months") setViewYear((year) => year - 1);
    else if (viewMonth === 0) { setViewYear((year) => year - 1); setViewMonth(11); }
    else setViewMonth((month) => month - 1);
  }

  function next() {
    const activeMode = jump ?? mode;
    if (activeMode === "years") setViewYear((year) => year + 12);
    else if (activeMode === "months") setViewYear((year) => year + 1);
    else if (viewMonth === 11) { setViewYear((year) => year + 1); setViewMonth(0); }
    else setViewMonth((month) => month + 1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const days = Array.from({ length: new Date(viewYear, viewMonth + 1, 0).getDate() }, (_, index) => index + 1);
  const yearStart = Math.floor(viewYear / 12) * 12;
  const rangeText = formatRange(draft, labels.date);

  return <div ref={ref} className="relative shrink-0">
    <button type="button" onClick={() => open ? setOpen(false) : openPicker()} aria-expanded={open} aria-haspopup="dialog" className="inline-flex h-8 items-center gap-1.5 rounded bg-[var(--surface-2)] px-2 text-xs font-semibold text-[var(--ink)] outline-none transition-colors hover:bg-[var(--border)] focus:ring-1 focus:ring-[var(--brand-primary)]"><CalendarDays size={14} className="text-[var(--muted)]" aria-hidden="true" /><span className="max-w-20 truncate sm:max-w-36">{formatRange(value, labels.date)}</span></button>
    {open && <div role="dialog" aria-label={labels.date} className="absolute right-0 top-10 z-20 w-72 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 shadow-lg">
      <div className="mb-3 grid grid-cols-3 gap-1 rounded bg-[var(--surface-2)] p-1">
        {(["days", "months", "years"] as const).map((item) => <button key={item} type="button" onClick={() => { setMode(item); setJump(null); }} className={`rounded px-1 py-1 text-[0.65rem] font-semibold uppercase tracking-wide transition-colors ${mode === item && !jump ? "bg-[var(--bg)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>{labels[item]}</button>)}
      </div>
      <div className="mb-2 flex items-center justify-between"><button type="button" onClick={previous} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]" aria-label="Previous"><ChevronLeft size={16} /></button>{mode === "days" && !jump ? <div className="flex"><button type="button" onClick={() => setJump("months")} className="rounded px-1 font-[family-name:var(--font-barlow-condensed)] text-sm font-bold uppercase tracking-wide text-[var(--ink)] hover:bg-[var(--surface-2)]">{monthNames[viewMonth]}</button><button type="button" onClick={() => setJump("years")} className="rounded px-1 font-[family-name:var(--font-barlow-condensed)] text-sm font-bold uppercase tracking-wide text-[var(--ink)] hover:bg-[var(--surface-2)]">{viewYear}</button></div> : <span className="font-[family-name:var(--font-barlow-condensed)] text-sm font-bold uppercase tracking-wide text-[var(--ink)]">{(jump ?? mode) === "months" ? viewYear : (jump ?? mode) === "years" ? `${yearStart}–${yearStart + 11}` : `${monthNames[viewMonth]} ${viewYear}`}</span>}<button type="button" onClick={next} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]" aria-label="Next"><ChevronRight size={16} /></button></div>
      {jump === "months" && <div className="grid grid-cols-3 gap-1">{monthNames.map((month, index) => <button key={month} type="button" onClick={() => { setViewMonth(index); setJump(null); }} className="h-9 rounded text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]">{month}</button>)}</div>}
      {jump === "years" && <div className="grid grid-cols-3 gap-1">{Array.from({ length: 12 }, (_, index) => yearStart + index).map((year) => <button key={year} type="button" onClick={() => { setViewYear(year); setJump("months"); }} className="h-9 rounded text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]">{year}</button>)}</div>}
      {!jump && mode === "days" && <div className="grid grid-cols-7 gap-x-0 gap-y-1 text-center text-xs">{Array.from({ length: offset }).map((_, index) => <span key={`empty-${index}`} />)}{days.map((day) => { const value = iso(viewYear, viewMonth, day); const start = value === draft.from; const end = value === draft.to; const inside = draft.from && draft.to && value > draft.from && value < draft.to; const rangeClass = start || end ? `bg-[var(--brand-primary)] font-bold text-white ${start && end ? "rounded" : start ? "rounded-l" : "rounded-r"}` : inside ? "bg-[var(--brand-primary-light)] text-[var(--brand-primary)]" : "rounded text-[var(--ink)] hover:bg-[var(--surface-2)]"; return <button key={value} type="button" onClick={() => pick(value)} className={`h-8 transition-colors ${rangeClass}`}>{day}</button>; })}</div>}
      {!jump && mode === "months" && <div className="grid grid-cols-3 gap-x-0 gap-y-1">{monthNames.map((month, index) => { const from = iso(viewYear, index, 1); const to = iso(viewYear, index + 1, 0); const start = from === draft.from; const end = to === draft.to; const inside = draft.from && draft.to && from > draft.from && to < draft.to; const rangeClass = start || end ? `bg-[var(--brand-primary)] text-white ${start && end ? "rounded" : start ? "rounded-l" : "rounded-r"}` : inside ? "bg-[var(--brand-primary-light)] text-[var(--brand-primary)]" : "rounded text-[var(--ink)] hover:bg-[var(--surface-2)]"; return <button key={month} type="button" onClick={() => pick(from, to)} className={`h-9 text-xs font-semibold transition-colors ${rangeClass}`}>{month}</button>; })}</div>}
      {!jump && mode === "years" && <div className="grid grid-cols-3 gap-x-0 gap-y-1">{Array.from({ length: 12 }, (_, index) => yearStart + index).map((year) => { const from = iso(year, 0, 1); const to = iso(year, 11, 31); const start = from === draft.from; const end = to === draft.to; const inside = draft.from && draft.to && from > draft.from && to < draft.to; const rangeClass = start || end ? `bg-[var(--brand-primary)] text-white ${start && end ? "rounded" : start ? "rounded-l" : "rounded-r"}` : inside ? "bg-[var(--brand-primary-light)] text-[var(--brand-primary)]" : "rounded text-[var(--ink)] hover:bg-[var(--surface-2)]"; return <button key={year} type="button" onClick={() => pick(from, to)} className={`h-9 text-xs font-semibold transition-colors ${rangeClass}`}>{year}</button>; })}</div>}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3"><span className="max-w-40 truncate font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] text-[var(--muted)]">{rangeText}</span><div className="flex gap-2"><button type="button" onClick={() => setDraft({ from: "", to: "" })} className="px-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">{labels.clear}</button><button type="button" onClick={() => { onApply(draft); setOpen(false); }} className="rounded bg-[var(--ink)] px-2.5 py-1 text-xs font-semibold text-[var(--bg)]">{labels.apply}</button></div></div>
    </div>}
  </div>;
}
