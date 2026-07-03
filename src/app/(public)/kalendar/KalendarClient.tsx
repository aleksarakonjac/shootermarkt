"use client";

import { useState, useMemo } from "react";
import Calendar from "react-calendar";
import Link from "next/link";
import "./kalendar.css";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

export type CalendarComp = {
  id: number;
  name: string;
  date: string;
  dateEnd: string | null;
  location: string | null;
  level: CompetitionLevel;
};

interface Props {
  competitions: CalendarComp[];
}

const LEVEL_META: Record<CompetitionLevel, { label: string; bg: string; color: string }> = {
  club:          { label: "Klubsko",      bg: "var(--surface-2)",     color: "var(--muted)"  },
  regional:      { label: "Regionalno",   bg: "var(--brand-accent)",  color: "white"         },
  national:      { label: "Državno",      bg: "var(--success)",       color: "white"         },
  international: { label: "Međunarodno",  bg: "oklch(0.52 0.15 220)", color: "white"         },
  continental:   { label: "Kont.",        bg: "oklch(0.62 0.18 55)",  color: "white"         },
  world:         { label: "ISSF–Svetsko", bg: "var(--brand-primary)", color: "white"         },
  olympic:       { label: "Olimpijsko",   bg: "oklch(0.65 0.18 75)",  color: "white"         },
};

const MONTHS_SR = [
  "Januar","Februar","Mart","April","Maj","Jun",
  "Jul","Avgust","Septembar","Oktobar","Novembar","Decembar",
];
const DAYS_SR = ["Ned","Pon","Uto","Sre","Čet","Pet","Sub"];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string, dateEnd: string | null): string {
  const MONTHS = ["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"];
  const d = new Date(dateStr + "T00:00:00");
  const s = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  if (!dateEnd || dateEnd === dateStr) return s;
  const de = new Date(dateEnd + "T00:00:00");
  if (de.getMonth() === d.getMonth()) return `${d.getDate()}–${de.getDate()}. ${MONTHS[d.getMonth()]}`;
  return `${s} – ${de.getDate()}. ${MONTHS[de.getMonth()]}`;
}

export function KalendarClient({ competitions }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeStartDate, setActiveStartDate] = useState<Date>(() => {
    // Start at month of nearest upcoming comp, or today
    const today = new Date();
    const upcoming = competitions.find((c) => new Date(c.date + "T00:00:00") >= today);
    if (upcoming) {
      const d = new Date(upcoming.date + "T00:00:00");
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Build event map: date key → competitions[]
  // Competitions spanning multiple days appear on each day
  const eventMap = useMemo(() => {
    const map = new Map<string, CalendarComp[]>();
    for (const comp of competitions) {
      const start = new Date(comp.date + "T00:00:00");
      const end = comp.dateEnd ? new Date(comp.dateEnd + "T00:00:00") : start;
      const cur = new Date(start);
      while (cur <= end) {
        const key = toKey(cur);
        const arr = map.get(key) ?? [];
        arr.push(comp);
        map.set(key, arr);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [competitions]);

  // Competitions shown in the list panel
  const listComps: CalendarComp[] = useMemo(() => {
    if (selectedDate) {
      // Selected day
      return eventMap.get(toKey(selectedDate)) ?? [];
    }
    // Active month — unique comps starting this month
    const y = activeStartDate.getFullYear();
    const m = activeStartDate.getMonth();
    const seen = new Set<number>();
    const result: CalendarComp[] = [];
    for (const comp of competitions) {
      const d = new Date(comp.date + "T00:00:00");
      if (d.getFullYear() === y && d.getMonth() === m) {
        if (!seen.has(comp.id)) {
          seen.add(comp.id);
          result.push(comp);
        }
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedDate, activeStartDate, eventMap, competitions]);

  const activeMonthLabel = `${MONTHS_SR[activeStartDate.getMonth()]} ${activeStartDate.getFullYear()}`;

  const listTitle = selectedDate
    ? `${selectedDate.getDate()}. ${MONTHS_SR[selectedDate.getMonth()].toLowerCase()} ${selectedDate.getFullYear()}.`
    : activeMonthLabel;

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* ── Calendar ───────────────────────────────────────────── */}
      <div className="w-full lg:w-auto lg:shrink-0 lg:sticky lg:top-[88px]">
        <Calendar
          value={selectedDate}
          onChange={(val) => setSelectedDate(val as Date | null)}
          activeStartDate={activeStartDate}
          onActiveStartDateChange={({ activeStartDate: d }) => {
            if (d) {
              setActiveStartDate(d);
              setSelectedDate(null);
            }
          }}
          formatDay={(_, date) => String(date.getDate())}
          formatMonthYear={(_, date) =>
            `${MONTHS_SR[date.getMonth()]} ${date.getFullYear()}`
          }
          formatShortWeekday={(_, date) => DAYS_SR[date.getDay()]}
          tileClassName={({ date, view }) => {
            if (view !== "month") return null;
            return eventMap.has(toKey(date)) ? "tile-has-event" : null;
          }}
          calendarType="iso8601"
          minDetail="year"
          className="shadow-sm"
        />

        {/* Clear selection */}
        {selectedDate && (
          <button
            onClick={() => setSelectedDate(null)}
            className="mt-2.5 w-full text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors py-1.5 rounded-lg hover:bg-[var(--surface-2)]"
          >
            ← Prikaži ceo mesec
          </button>
        )}
      </div>

      {/* ── List panel ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-5 gap-3">
          <h2
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
            style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", letterSpacing: "-0.02em" }}
          >
            {listTitle}
          </h2>
          <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] shrink-0">
            {listComps.length} {listComps.length === 1 ? "takmičenje" : "takmičenja"}
          </span>
        </div>

        {listComps.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-14 text-center">
            <p className="text-sm text-[var(--muted)]">
              {selectedDate ? "Nema takmičenja ovog dana." : "Nema takmičenja ovog meseca."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            {listComps.map((comp, idx) => {
              const meta = LEVEL_META[comp.level];
              const isLast = idx === listComps.length - 1;
              return (
                <Link
                  key={comp.id}
                  href={`/takmicenja/${comp.id}`}
                  className={`group flex items-center gap-3 sm:gap-4 px-4 py-4 transition-colors hover:bg-[var(--surface-2)] ${
                    !isLast ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  {/* Date block */}
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center border border-[var(--border)]"
                    aria-hidden="true"
                  >
                    <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm leading-none text-[var(--ink)] tabular-nums">
                      {new Date(comp.date + "T00:00:00").getDate()}
                    </span>
                    <span className="text-[0.6rem] font-semibold text-[var(--muted)] uppercase mt-0.5 leading-none">
                      {MONTHS_SR[new Date(comp.date + "T00:00:00").getMonth()].slice(0, 3)}
                    </span>
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors truncate text-sm leading-snug">
                      {comp.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)] tabular-nums">
                        {formatDisplayDate(comp.date, comp.dateEnd)}
                      </span>
                      {comp.location && (
                        <span className="text-[0.65rem] text-[var(--subtle)] truncate hidden sm:block">
                          · {comp.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level badge */}
                  {meta && (
                    <span
                      className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[0.62rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide whitespace-nowrap"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  )}

                  {/* Chevron */}
                  <svg
                    width="12" height="12" viewBox="0 0 12 12"
                    className="shrink-0 text-[var(--border-strong)] group-hover:text-[var(--muted)] transition-colors hidden sm:block"
                    aria-hidden="true"
                  >
                    <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
