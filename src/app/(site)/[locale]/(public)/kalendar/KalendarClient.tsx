"use client";

import { useState, useMemo } from "react";
import Calendar from "react-calendar";
import { Link } from "@/i18n/navigation";
import "./kalendar.css";
import type { CompetitionLevel } from "@/lib/pdf-import/types";
import { LEVEL_STYLE } from "@/lib/competition-utils";
import { useTranslations, useLocale } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";

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

type LevelFilter = "all" | "olympic" | "world" | "continental" | "international" | "national" | "regional" | "club";

function levelMatchesFilter(level: CompetitionLevel, filter: LevelFilter): boolean {
  if (filter === "all") return true;
  return level === filter;
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function KalendarClient({ competitions }: Props) {
  const t = useTranslations("calendar");
  const tHome = useTranslations("home");
  const locale = useLocale();
  const scopedHref = useScopedHref();

  const FILTER_TABS: { key: LevelFilter; label: string }[] = [
    { key: "all",           label: tCommonLabel("all") },
    { key: "olympic",       label: tHome("level.olympic") },
    { key: "world",         label: tHome("level.world") },
    { key: "continental",   label: tHome("level.continental") },
    { key: "international", label: tHome("level.international") },
    { key: "national",      label: tHome("level.national") },
    { key: "regional",      label: tHome("level.regional") },
    { key: "club",          label: tHome("level.club") },
  ];

  function tCommonLabel(key: string): string {
    if (key === "all") {
      return locale === "en" ? "All" : "Svi";
    }
    return "";
  }

  const LEVEL_META: Record<CompetitionLevel, { label: string; bg: string; color: string }> = {
    club:          { label: tHome("level.club"),          bg: LEVEL_STYLE.club.background,          color: LEVEL_STYLE.club.color          },
    regional:      { label: tHome("level.regional"),      bg: LEVEL_STYLE.regional.background,      color: LEVEL_STYLE.regional.color      },
    national:      { label: tHome("level.national"),      bg: LEVEL_STYLE.national.background,      color: LEVEL_STYLE.national.color      },
    international: { label: tHome("level.international"), bg: LEVEL_STYLE.international.background, color: LEVEL_STYLE.international.color },
    continental:   { label: tHome("level.continental"),   bg: LEVEL_STYLE.continental.background,   color: LEVEL_STYLE.continental.color   },
    world:         { label: tHome("level.world"),         bg: LEVEL_STYLE.world.background,         color: LEVEL_STYLE.world.color         },
    olympic:       { label: tHome("level.olympic"),       bg: LEVEL_STYLE.olympic.background,       color: LEVEL_STYLE.olympic.color       },
  };

  function formatDisplayDate(dateStr: string, dateEnd: string | null): string {
    const d = new Date(dateStr + "T00:00:00");
    const s = `${d.getDate()}. ${t(`monthsShort.${d.getMonth()}`)}`;
    if (!dateEnd || dateEnd === dateStr) return s;
    const de = new Date(dateEnd + "T00:00:00");
    if (de.getMonth() === d.getMonth()) return `${d.getDate()}–${de.getDate()}. ${t(`monthsShort.${d.getMonth()}`)}`;
    return `${s} – ${de.getDate()}. ${t(`monthsShort.${de.getMonth()}`)}`;
  }

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

  const activeMonthLabel = `${t(`months.${activeStartDate.getMonth()}`)} ${activeStartDate.getFullYear()}`;
  const listTitle = selectedDate
    ? `${selectedDate.getDate()}. ${t(`months.${selectedDate.getMonth()}`).toLowerCase()} ${selectedDate.getFullYear()}.`
    : activeMonthLabel;

  // Key change triggers remount → entrance animation replays
  const listKey = listTitle + "|" + levelFilter;

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      {/* ── Calendar ──────────────────────────────────────────── */}
      <div className="w-full lg:w-auto lg:shrink-0 lg:sticky lg:top-[88px]">
        <Calendar
          value={selectedDate}
          onChange={(val) => {
            const clicked = val as Date | null;
            if (clicked && selectedDate && toKey(clicked) === toKey(selectedDate)) {
              setSelectedDate(null);
            } else {
              setSelectedDate(clicked);
            }
          }}
          activeStartDate={activeStartDate}
          onActiveStartDateChange={({ activeStartDate: d }) => {
            if (d) {
              setActiveStartDate(d);
              setSelectedDate(null);
            }
          }}
          formatDay={(_, date) => String(date.getDate())}
          formatMonthYear={(_, date) =>
            `${t(`months.${date.getMonth()}`)} ${date.getFullYear()}`
          }
          formatMonth={(_, date) => t(`months.${date.getMonth()}`)}
          formatShortWeekday={(_, date) => t(`weekdays.${date.getDay()}`)}
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
        <p className="mt-2 text-center text-[0.65rem] text-[var(--subtle)]">
          {t("clickHint")}
        </p>
      </div>

      {/* ── List panel ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Level filters */}
        <div
          className="flex flex-wrap gap-1.5 mb-5"
          role="group"
          aria-label="Filter po nivou takmičenja"
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setLevelFilter(tab.key)}
              aria-pressed={levelFilter === tab.key}
              className={`shrink-0 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
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
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 mb-5 sm:flex sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
            <h2
              className="min-w-0 font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
              style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", letterSpacing: "-0.02em" }}
            >
              {listTitle}
            </h2>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => {
                  const d = new Date(activeStartDate);
                  d.setMonth(d.getMonth() - 1);
                  setActiveStartDate(d);
                  setSelectedDate(null);
                }}
                aria-label="Prethodni mesec"
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
              <button
                onClick={() => {
                  const d = new Date(activeStartDate);
                  d.setMonth(d.getMonth() + 1);
                  setActiveStartDate(d);
                  setSelectedDate(null);
                }}
                aria-label="Sledeći mesec"
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
              {(activeStartDate.getFullYear() !== today.getFullYear() || activeStartDate.getMonth() !== today.getMonth()) && (
                <button
                  onClick={() => {
                    setActiveStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
                    setSelectedDate(null);
                  }}
                  aria-label="Trenutni mesec"
                  className="ml-1 px-2 h-6 flex items-center rounded text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Danas
                </button>
              )}
            </div>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[0.7rem] font-semibold bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--ink)] transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M6.5 2L3.5 5L6.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                {t("allMonth")}
              </button>
            )}
          </div>
          <span className="col-span-2 text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] sm:col-auto shrink-0">
            {t("competitionPlural", { count: listComps.length })}
          </span>
        </div>

        {listComps.length === 0 ? (
          <div
            key={listKey}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-14 text-center kalendar-list"
          >
            <p className="text-sm text-[var(--muted)]">
              {selectedDate ? t("noEventsDay") : t("noEvents")}
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
              const countdownChip = showCountdown ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[0.62rem] font-bold font-[family-name:var(--font-jetbrains-mono)] tabular-nums whitespace-nowrap countdown-chip">
                  {daysUntil === 0
                    ? t("today")
                    : daysUntil === 1
                    ? t("tomorrow")
                    : t("daysCount", { count: daysUntil })}
                </span>
              ) : null;
              const levelBadge = meta ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[0.62rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide whitespace-nowrap"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.label}
                </span>
              ) : null;

              return (
                <Link
                  key={comp.id}
                  href={scopedHref(`/takmicenja/${comp.id}`)}
                  className={`group flex items-start gap-2.5 px-3 py-4 transition-colors hover:bg-[var(--surface-2)] sm:items-center sm:gap-4 sm:px-4 kalendar-item ${
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
                      {t(`monthsShort.${new Date(comp.date + "T00:00:00").getMonth()}`)}
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
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                      {countdownChip}
                      {levelBadge}
                    </div>
                  </div>

                  {/* Countdown + level badge */}
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    {countdownChip}
                    {levelBadge}
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
