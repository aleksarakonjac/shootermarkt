"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Calendar from "react-calendar";
import { Link } from "@/i18n/navigation";
import "./kalendar.css";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";
import { LEVEL_STYLE } from "@/lib/competition-utils";
import { useTranslations, useLocale } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";

const MAX_DOTS = 4;
const SWIPE_DISTANCE_RATIO = 0.25;
const SWIPE_VELOCITY = 0.5; // px/ms
const SETTLE_MS = 220;

type CalendarView = "month" | "year" | "decade" | "century";
type SwipeGesture = { id: number; x: number; y: number; lastX: number; lastT: number; vx: number; axis: "x" | "y" | null };

// Pomeranje aktivnog perioda za jedan korak u trenutnom prikazu (mesec / godina / decenija / vek).
function shiftPeriod(date: Date, view: CalendarView, dir: 1 | -1) {
  const y = date.getFullYear();
  if (view === "month") return new Date(y, date.getMonth() + dir, 1);
  if (view === "year") return new Date(y + dir, 0, 1);
  return new Date(y + dir * (view === "decade" ? 10 : 100), 0, 1);
}
const LEVEL_ORDER = ["olympic", "world", "continental", "international", "national", "regional", "club"];
const levelRank = (level: string) => { const i = LEVEL_ORDER.indexOf(level); return i === -1 ? LEVEL_ORDER.length : i; };

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
  const [view, setView] = useState<CalendarView>("month");
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

  // Swipe (samo dodir): mreža prati prst; na otpuštanju klizi na susedni period ili se vraća.
  const swipeRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<SwipeGesture | null>(null);
  const swipeTimer = useRef<number | undefined>(undefined);
  const [dragX, setDragX] = useState(0);
  const [swipeMode, setSwipeMode] = useState<"idle" | "drag" | "settle">("idle");
  useEffect(() => () => window.clearTimeout(swipeTimer.current), []);

  const finishSwipe = (cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== "x") return;
    const width = swipeRef.current?.offsetWidth ?? 0;
    const passed = !cancelled && width > 0 && dragX !== 0 && (Math.abs(dragX) > width * SWIPE_DISTANCE_RATIO || Math.abs(g.vx) > SWIPE_VELOCITY);
    const dir: 1 | -1 | 0 = passed ? (dragX < 0 ? 1 : -1) : 0; // swipe levo → sledeći period
    setSwipeMode("settle");
    setDragX(dir === 0 ? 0 : -dir * width);
    swipeTimer.current = window.setTimeout(() => {
      if (dir === 0) { setSwipeMode("idle"); return; }
      setActiveStartDate((current) => shiftPeriod(current, view, dir));
      setSelectedDate(null);
      // Novi period ulazi s suprotne strane.
      setSwipeMode("drag");
      setDragX(dir * width);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setSwipeMode("settle");
        setDragX(0);
        swipeTimer.current = window.setTimeout(() => setSwipeMode("idle"), SETTLE_MS);
      }));
    }, SETTLE_MS);
  };

  const swipeHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch" || swipeMode !== "idle") return;
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: e.timeStamp, vx: 0, axis: null };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (g.axis === "x") {
          e.currentTarget.setPointerCapture(e.pointerId);
          setSwipeMode("drag");
        }
      }
      if (g.axis !== "x") return;
      const dt = e.timeStamp - g.lastT;
      if (dt > 0) g.vx = (e.clientX - g.lastX) / dt;
      g.lastX = e.clientX;
      g.lastT = e.timeStamp;
      setDragX(dx);
    },
    onPointerUp: () => finishSwipe(false),
    onPointerCancel: () => finishSwipe(true),
  };

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

  const filterPills = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={locale === "en" ? "Filter by competition level" : "Filter po nivou takmičenja"}>
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
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
      <style>{`.react-calendar__navigation__label{text-align:center!important;padding-left:0!important}.react-calendar__navigation__label::before{content:"Septembar 2026";display:block;visibility:hidden;height:0;overflow:hidden;font:inherit}`}</style>

      {/* Filters — above calendar on mobile only */}
      <div className="w-full lg:hidden">{filterPills}</div>

      {/* ── Calendar ──────────────────────────────────────────── */}
      <div className="w-full lg:w-auto lg:shrink-0 lg:sticky lg:top-[calc(var(--site-header-h,3.5rem)+2rem)]">
        <div
          ref={swipeRef}
          className="kalendar-swipe touch-pan-y"
          data-swipe={swipeMode}
          style={{ "--drag-x": `${dragX}px` } as React.CSSProperties}
          {...swipeHandlers}
        >
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
          onViewChange={({ view: next }) => { if (next) setView(next as CalendarView); }}
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
          tileContent={({ date, view }) => {
            if (view !== "month") return null;
            const dayComps = eventMap.get(toKey(date));
            if (!dayComps?.length) return null;
            const dots = dayComps.toSorted((x, y) => levelRank(x.level) - levelRank(y.level));
            const shown = dots.slice(0, MAX_DOTS);
            return (
              <span className="tile-dots" aria-hidden="true">
                {shown.map((c) => <span key={c.id} className="tile-dot" style={{ background: `var(--level-${c.level}-fg)` }} />)}
                {dots.length > shown.length && <span className="tile-dot-more">+</span>}
              </span>
            );
          }}
          calendarType="iso8601"
          minDetail="year"
          className="shadow-sm"
        />
        </div>
        <p className="mt-2 text-center text-[0.65rem] text-[var(--subtle)]">
          {t("clickHint")}
        </p>
      </div>

      {/* ── List panel ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 w-full lg:w-auto">
        {/* Level filters — desktop only (mobile shown above calendar) */}
        <div className="hidden lg:block mb-5">{filterPills}</div>

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
                aria-label={locale === "en" ? "Previous month" : "Prethodni mesec"}
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
                aria-label={locale === "en" ? "Next month" : "Sledeći mesec"}
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
                  aria-label={locale === "en" ? "Current month" : "Trenutni mesec"}
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
                  aria-label={`${comp.name}, ${formatDisplayDate(comp.date, comp.dateEnd)}${comp.location ? `, ${comp.location}` : ""}${isPast ? (locale === "en" ? ", finished" : ", završeno") : ""}`}
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
