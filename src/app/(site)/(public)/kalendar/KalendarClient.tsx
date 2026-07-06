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

type LevelFilter = "all" | "national" | "regional" | "international" | "club";

const FILTER_TABS: { key: LevelFilter; label: string }[] = [
  { key: "all",           label: "Svi" },
  { key: "national",      label: "Državno" },
  { key: "regional",      label: "Regionalno" },
  { key: "international", label: "Međunarodno" },
  { key: "club",          label: "Klubsko" },
];

const INTL_LEVELS: CompetitionLevel[] = ["international", "continental", "world", "olympic"];

function levelMatchesFilter(level: CompetitionLevel, filter: LevelFilter): boolean {
  if (filter === "all") return true;
  if (filter === "international") return INTL_LEVELS.includes(level);
  return level === filter;
}

const LEVEL_META: Record<CompetitionLevel, { label: string; bg: string; color: string }> = {
  club:          { label: "Klubsko",       bg: "var(--surface-2)",      color: "var(--muted)"  },
  regional:      { label: "Regionalno",    bg: "var(--brand-accent)",   color: "white"         },
  national:      { label: "Državno",       bg: "var(--success)",        color: "white"         },
  international: { label: "Međunarodno",   bg: "oklch(0.52 0.15 220)",  color: "white"         },
  continental:   { label: "Kontinentalno", bg: "oklch(0.62 0.18 55)",   color: "white"         },
  world:         { label: "ISSF–Svetsko",  bg: "var(--brand-primary)",  color: "white"         },
  olympic:       { label: "Olimpijsko",    bg: "oklch(0.65 0.18 75)",   color: "white"         },
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

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function KalendarClient({ competitions }: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = toKey(today);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [activeStartDate, setActiveStartDate] = useState<Date>(() => {
    const upcoming = competitions.find((c) => new Date(c.date + "T00:00:00") >= today);
    if (upcoming) {
      const d = new Date(upcoming.date + "T00:00:00");
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Event map uses ALL competitions (calendar dots unaffected by level filter)
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

  const filteredComps = useMemo(
    () => competitions.filter((c) => levelMatchesFilter(c.level, levelFilter)),
    [competitions, levelFilter],
  );

  const listComps: CalendarComp[] = useMemo(() => {
    if (selectedDate) {
      const key = toKey(selectedDate);
      return (eventMap.get(key) ?? []).filter((c) => levelMatchesFilter(c.level, levelFilter));
    }
    const y = activeStartDate.getFullYear();
    const m = activeStartDate.getMonth();
    const seen = new Set<number>();
    const result: CalendarComp[] = [];
    for (const comp of filteredComps) {
      const d = new Date(comp.date + "T00:00:00");
      if (d.getFullYear() === y && d.getMonth() === m) {
        if (!seen.has(comp.id)) {
          seen.add(comp.id);
          result.push(comp);
        }
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedDate, activeStartDate, filteredComps, eventMap, levelFilter]);

  const activeMonthLabel = `${MONTHS_SR[activeStartDate.getMonth()]} ${activeStartDate.getFullYear()}`;
  const listTitle = selectedDate
    ? `${selectedDate.getDate()}. ${MONTHS_SR[selectedDate.getMonth()].toLowerCase()} ${selectedDate.getFullYear()}.`
    : activeMonthLabel;

  // Key change triggers remount → entrance animation replays
  const listKey = listTitle + "|" + levelFilter;

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* ── Calendar ──────────────────────────────────────────── */}
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
          formatMonth={(_, date) => MONTHS_SR[date.getMonth()]}
          formatShortWeekday={(_, date) => DAYS_SR[date.getDay()]}
          tileClassName={({ date, view }) => {
            if (view !== "month") return null;
            const key = toKey(date);
            const dayComps = eventMap.get(key);
            if (!dayComps) return null;
            const levels = dayComps.map((c) => c.level);
            if (levels.some((l) => l === "world" || l === "olympic"))
              return "tile-has-event tile-level-world";
            if (levels.some((l) => l === "international" || l === "continental"))
              return "tile-has-event tile-level-intl";
            if (levels.some((l) => l === "national"))
              return "tile-has-event tile-level-national";
            if (levels.some((l) => l === "regional"))
              return "tile-has-event tile-level-regional";
            return "tile-has-event tile-level-club";
          }}
          calendarType="iso8601"
          minDetail="year"
          className="shadow-sm"
        />
        {selectedDate && (
          <button
            onClick={() => setSelectedDate(null)}
            className="mt-2.5 w-full text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors py-1.5 rounded-lg hover:bg-[var(--surface-2)]"
          >
            ← Prikaži ceo mesec
          </button>
        )}
      </div>

      {/* ── List panel ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Level filter pills — horizontal scroll on mobile */}
        <div
          className="flex gap-1.5 mb-5 overflow-x-auto pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap"
          role="group"
          aria-label="Filter po nivou takmičenja"
          style={{ scrollbarWidth: "none" }}
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setLevelFilter(tab.key)}
              aria-pressed={levelFilter === tab.key}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                levelFilter === tab.key
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Title row */}
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
          <div
            key={listKey}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-14 text-center kalendar-list"
          >
            <p className="text-sm text-[var(--muted)]">
              {selectedDate ? "Nema takmičenja ovog dana." : "Nema takmičenja ovog meseca."}
            </p>
          </div>
        ) : (
          <div key={listKey} className="rounded-xl border border-[var(--border)] overflow-hidden kalendar-list">
            {listComps.map((comp, idx) => {
              const meta = LEVEL_META[comp.level];
              const isLast = idx === listComps.length - 1;
              // Past when the end date (or start date for single-day) is before today
              const endKey = comp.dateEnd ?? comp.date;
              const isPast = endKey < todayKey;
              const daysUntil = getDaysUntil(comp.date);
              // Countdown chip: only for competitions that haven't started yet, within 30 days
              const showCountdown = !isPast && daysUntil >= 0 && daysUntil <= 30;

              return (
                <Link
                  key={comp.id}
                  href={`/takmicenja/${comp.id}`}
                  className={`group flex items-center gap-3 sm:gap-4 px-4 py-4 transition-colors hover:bg-[var(--surface-2)] kalendar-item ${
                    !isLast ? "border-b border-[var(--border)]" : ""
                  } ${isPast ? "opacity-60" : ""}`}
                  style={{ "--idx": Math.min(idx, 8) } as React.CSSProperties}
                  aria-label={`${comp.name}, ${formatDisplayDate(comp.date, comp.dateEnd)}${comp.location ? `, ${comp.location}` : ""}${isPast ? ", završeno" : ""}`}
                >
                  {/* Date block */}
                  <div
                    className={`shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center border transition-colors ${
                      isPast
                        ? "border-[var(--border)]"
                        : "border-[var(--border-strong)]"
                    }`}
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

                  {/* Countdown + level badge */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {showCountdown && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.62rem] font-bold font-[family-name:var(--font-jetbrains-mono)] tabular-nums whitespace-nowrap countdown-chip">
                        {daysUntil === 0
                          ? "Danas!"
                          : daysUntil === 1
                          ? "Sutra"
                          : `za ${daysUntil}d`}
                      </span>
                    )}
                    {meta && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[0.62rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide whitespace-nowrap"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>

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
