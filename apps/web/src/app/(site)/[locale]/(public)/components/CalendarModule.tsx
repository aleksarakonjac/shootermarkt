"use client";

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { LEVEL_DOT_COLOR } from "@/lib/competition-utils";
import { CalendarDayEvents } from "./CalendarDayEvents";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { useHomepageDataStatus } from "../[scope]/homepage-data-status";

interface Competition {
  id: number;
  name: string;
  date: string;
  endDate?: string | null;
  location: string | null;
  level: string;
  countryName?: string | null;
  countryCode2?: string | null;
}

interface CalendarModuleProps {
  competitions?: Competition[];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

function getLevelColor(level: string): string {
  return LEVEL_DOT_COLOR[level.toLowerCase()] ?? LEVEL_DOT_COLOR["club"];
}

const MAX_DOTS = 4;
const SETTLE_MS = 220;
const SWIPE_DISTANCE_RATIO = 0.25;
const SWIPE_VELOCITY = 0.5; // px/ms

function buildCompsByDate(list: Competition[]) {
  const map = new Map<string, Competition[]>();
  for (const c of list) {
    const cur = new Date(`${c.date.slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${(c.endDate ?? c.date).slice(0, 10)}T00:00:00Z`);
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      if (!map.has(ds)) map.set(ds, []);
      map.get(ds)!.push(c);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return map;
}

// One dot per competition on the day, most prominent level first.
function CompetitionDots({ comps, onBrand = false }: { comps: Competition[]; onBrand?: boolean }) {
  const levels = Object.keys(LEVEL_DOT_COLOR);
  const rank = (level: string) => { const i = levels.indexOf(level.toLowerCase()); return i === -1 ? levels.length : i; };
  const dots = comps.toSorted((a, b) => rank(a.level) - rank(b.level)).slice(0, MAX_DOTS);
  return <span className={`absolute bottom-1.5 flex ${onBrand ? "gap-1" : "gap-0.5"}`} aria-hidden="true">
    {dots.map((c) => <span key={c.id} className="h-1 w-1 rounded-full" style={{ background: getLevelColor(c.level), boxShadow: onBrand ? "0 0 0 1px #fff" : undefined }} />)}
  </span>;
}

// Prozor dana je u portalu (position: fixed) da ga ne seče overflow kalendara ni sekcije ispod:
// otvara se ispod ćelije, a ako dole nema mesta, iznad; uvek ostaje unutar viewporta.
function DayTooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = markerRef.current?.parentElement;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const margin = 8;
      let top = a.bottom;
      if (top + h > window.innerHeight - margin && a.top - h >= margin) top = a.top - h;
      top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));
      const left = Math.max(margin, Math.min(a.left + a.width / 2 - w / 2, window.innerWidth - w - margin));
      setPos({ left, top });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [id]);

  return (
    <>
      <span ref={markerRef} hidden />
      {createPortal(
        // Providni p-1 premošćuje razmak do ćelije da hover ne pukne na putu do prozora.
        <div
          ref={tipRef}
          id={id}
          className="fixed z-50 w-60 p-1 sm:w-80"
          style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
        >
          <div className="max-h-[70vh] overflow-y-auto rounded-lg bg-[oklch(0.22_0.012_28)] p-3 text-xs text-white shadow-lg">{children}</div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function CalendarModule({ competitions }: CalendarModuleProps) {
  const t = useTranslations("calendar");
  const common = useTranslations("common");
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();
  const scopedHref = useScopedHref();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);
  const initialMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const [monthCache, setMonthCache] = useState<Record<string, Competition[]>>(() => competitions ? { [initialMonthKey]: competitions } : {});
  const [monthState, setMonthState] = useState<Record<string, "loading" | "ready" | "error">>(() => competitions ? { [initialMonthKey]: "ready" } : {});
  const autoRetriedMonths = useRef(new Set<string>());
  // Zahtevi u letu: kad prvi odgovor promeni monthCache, effect se ponovo pokrene pre nego što
  // stignu ostali, pa bi bez ovoga isti meseci bili traženi ponovo.
  const inFlightMonths = useRef(new Set<string>());
  const { clearFailure, reportFailure } = useHomepageDataStatus();

  const loadMonth = useCallback(async (year: number, month: number) => {
    const key = `${year}-${month}`;
    if (Object.hasOwn(monthCache, key) || inFlightMonths.current.has(key)) return;
    inFlightMonths.current.add(key);
    const isCurrentMonth = key === `${viewYear}-${viewMonth}`;
    if (isCurrentMonth) clearFailure("calendar");
    setMonthState((states) => ({ ...states, [key]: "loading" }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`/api/calendar?year=${year}&month=${month + 1}&scope=${scope ?? "srb"}&locale=${locale}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Calendar request failed");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid calendar response");
      setMonthCache((cache) => Object.hasOwn(cache, key) ? cache : { ...cache, [key]: data });
      setMonthState((states) => ({ ...states, [key]: "ready" }));
      if (isCurrentMonth) clearFailure("calendar");
    } catch {
      setMonthState((states) => ({ ...states, [key]: "error" }));
    } finally {
      clearTimeout(timeout);
      inFlightMonths.current.delete(key);
    }
  }, [clearFailure, locale, monthCache, scope, viewMonth, viewYear]);

  useEffect(() => {
    const previous = new Date(viewYear, viewMonth - 1, 1);
    const next = new Date(viewYear, viewMonth + 1, 1);
    const timeout = setTimeout(() => {
      void loadMonth(viewYear, viewMonth);
      void loadMonth(previous.getFullYear(), previous.getMonth());
      void loadMonth(next.getFullYear(), next.getMonth());
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadMonth, viewMonth, viewYear]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pickerOpen]);

  const openPicker = () => {
    setPickerYear(viewYear);
    setPickerOpen(true);
  };

  const selectMonth = (month: number) => {
    setViewMonth(month);
    setViewYear(pickerYear);
    setPickerOpen(false);
  };

  const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const goToCurrent = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setPickerOpen(false);
  };

  const mapFor = (key: string) => buildCompsByDate(monthCache[key] ?? []);
  const compsByDate = useMemo(
    () => buildCompsByDate(monthCache[`${viewYear}-${viewMonth}`] ?? []),
    [monthCache, viewMonth, viewYear],
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const currentMonthKey = `${viewYear}-${viewMonth}`;
  const currentState = monthState[currentMonthKey] ?? "loading";

  useEffect(() => {
    if (currentState !== "error") return;
    reportFailure("calendar", () => void loadMonth(viewYear, viewMonth));
    if (autoRetriedMonths.current.has(currentMonthKey)) return;
    autoRetriedMonths.current.add(currentMonthKey);
    const timeout = window.setTimeout(() => void loadMonth(viewYear, viewMonth), 3_000);
    return () => window.clearTimeout(timeout);
  }, [currentMonthKey, currentState, loadMonth, reportFailure, viewMonth, viewYear]);


  const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];

  const renderMonth = (year: number, month: number, active: boolean) => {
    const monthComps = active ? compsByDate : mapFor(`${year}-${month}`);
    const monthDays = getDaysInMonth(year, month);
    const monthCells: (number | null)[] = [
      ...Array(getFirstDayOfMonth(year, month)).fill(null),
      ...Array.from({ length: monthDays }, (_, i) => i + 1),
    ];
    while (monthCells.length % 7 !== 0) monthCells.push(null);
    const selected = active ? selectedDate : null;
    const selectedHere = selected ? (monthComps.get(selected) ?? []) : [];
    const loaded = monthState[`${year}-${month}`] === "ready";
    return (
      <>
        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_ORDER.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
            >
              {t(`weekdays.${d}`)}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {monthCells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const comps = monthComps.get(dateStr) ?? [];
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const hasComp = comps.length > 0;
            const hasOneComp = comps.length === 1;

            // Span position + tooltip placement
            const col = idx % 7;
            // Round only where the highlighted run really ends — a neighbouring
            // day with any competition (even a different one) keeps it joined.
            const dayKey = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const joinsPrev = hasComp && col > 0 && day > 1 && monthComps.has(dayKey(day - 1)) && !isToday && !(day - 1 === today.getDate() && month === today.getMonth() && year === today.getFullYear());
            const joinsNext = hasComp && col < 6 && day < monthDays && monthComps.has(dayKey(day + 1)) && !isToday && !(day + 1 === today.getDate() && month === today.getMonth() && year === today.getFullYear());
            const roundLeft  = !joinsPrev;
            const roundRight = !joinsNext;
            const roundedClass =
              roundLeft && roundRight ? "rounded-md" :
              roundLeft               ? "rounded-l-md rounded-r-none" :
              roundRight              ? "rounded-r-md rounded-l-none" :
                                        "rounded-none";

            return (
              <div
                key={dateStr}
                className="relative"
                onMouseLeave={() => setSelectedDate((value) => value === dateStr ? null : value)}
              >
                {hasOneComp ? (
                  <Link
                    href={scopedHref(`/takmicenja/${comps[0].id}`)}
                    onFocus={() => setSelectedDate(dateStr)}
                    onMouseEnter={() => setSelectedDate(dateStr)}
                    aria-describedby={selected === dateStr ? `calendar-events-${dateStr}` : undefined}
                    aria-label={`${dateStr}: ${comps[0].name}`}
                    className={[
                      `relative flex min-h-11 w-full items-center justify-center py-1.5 text-sm font-semibold transition-colors select-none ${roundedClass}`,
                      isToday
                        ? "bg-[var(--brand-primary)] text-white font-bold ring-2 ring-[var(--brand-primary)] ring-offset-1"
                        : "bg-[var(--brand-primary)]/10 text-[var(--ink)] hover:bg-[var(--brand-primary)]/20 cursor-pointer",
                    ].join(" ")}
                  >
                    {day}
                    <CompetitionDots comps={comps} onBrand={isToday} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => hasComp && setSelectedDate((value) => value === dateStr ? null : dateStr)}
                    onFocus={() => hasComp && setSelectedDate(dateStr)}
                    onMouseEnter={() => hasComp && setSelectedDate(dateStr)}
                    aria-expanded={hasComp ? selected === dateStr : undefined}
                    aria-describedby={hasComp && selected === dateStr ? `calendar-events-${dateStr}` : undefined}
                    aria-label={hasComp ? `${dateStr}: ${t("competitionPlural", { count: comps.length })}` : dateStr}
                    disabled={!hasComp}
                    className={[
                      `relative flex min-h-11 w-full items-center justify-center py-1.5 text-sm font-semibold transition-colors select-none ${roundedClass}`,
                      isToday
                        ? "bg-[var(--brand-primary)] text-white font-bold ring-2 ring-[var(--brand-primary)] ring-offset-1"
                        : hasComp
                          ? "bg-[var(--brand-primary)]/10 text-[var(--ink)] hover:bg-[var(--brand-primary)]/20 cursor-pointer"
                          : "cursor-default text-[var(--ink)]",
                    ].join(" ")}
                  >
                    {day}
                    {hasComp && <CompetitionDots comps={comps} onBrand={isToday} />}
                  </button>
                )}

                {/* Tooltip */}
                {selected === dateStr && selectedHere.length > 0 && (
                  <DayTooltip id={`calendar-events-${dateStr}`}>
                    <CalendarDayEvents comps={selectedHere.map((c) => ({ ...c, endDate: c.endDate ?? null }))} locale={locale} />
                  </DayTooltip>
                )}
              </div>
            );
          })}
        </div>

        {active && loaded && monthComps.size === 0 && <p className="py-2 text-center text-sm text-[var(--muted)]">{t("noEvents")}</p>}
      </>
    );
  };

  // Interactive swipe (touch only): the three-month track follows the finger; on release it
  // either settles on the neighbouring month or springs back.
  const viewportRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; lastX: number; lastT: number; vx: number; axis: "x" | "y" | null } | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const activePanelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);
  // Track is as tall as the tallest of 3 months; size the viewport to the active one so 5-row months have no blank row.
  useLayoutEffect(() => {
    const el = activePanelRef.current;
    if (!el) return;
    const measure = () => setPanelHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewYear, viewMonth, currentState]);
  const [dragX, setDragX] = useState(0);
  const [settling, setSettling] = useState(false);
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const finishSwipe = (cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== "x") return;
    const width = viewportRef.current?.offsetWidth ?? 0;
    const passed = !cancelled && width > 0 && (Math.abs(dragX) > width * SWIPE_DISTANCE_RATIO || Math.abs(g.vx) > SWIPE_VELOCITY) && dragX !== 0;
    const dir = passed ? (dragX < 0 ? 1 : -1) : 0; // swipe left → next month
    setSettling(true);
    setDragX(dir === 0 ? 0 : -dir * width);
    settleTimer.current = window.setTimeout(() => {
      if (dir === 1) nextMonth();
      else if (dir === -1) prevMonth();
      setSettling(false);
      setDragX(0);
    }, SETTLE_MS);
  };

  const swipeHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch" || settling || pickerOpen) return;
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
          setSelectedDate(null);
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

  const prevOf = new Date(viewYear, viewMonth - 1, 1);
  const nextOf = new Date(viewYear, viewMonth + 1, 1);
  const panels = [
    { offset: -1, year: prevOf.getFullYear(), month: prevOf.getMonth() },
    { offset: 0, year: viewYear, month: viewMonth },
    { offset: 1, year: nextOf.getFullYear(), month: nextOf.getMonth() },
  ];


  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      {/* Header */}
      <div className="relative flex items-center justify-between rounded-t-xl bg-[var(--brand-primary)] px-4 py-1.5">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold uppercase tracking-wider text-white">
          {t("title")}
        </h3>
        {/* Today: centered in the space between the title and the month nav */}
        <div className="flex min-w-0 flex-1 justify-center">
          {!isCurrentMonthView && (
            <button
              type="button"
              onClick={goToCurrent}
              className="rounded border border-white/60 px-2 py-px text-[11px] font-semibold uppercase leading-4 tracking-wide text-white transition-colors hover:bg-white/15"
            >
              {locale === "en" ? "Today" : "Danas"}
            </button>
          )}
        </div>
        <div className="flex items-center">
          <button
            onClick={prevMonth}
            className="h-8 w-7 flex items-center justify-center rounded text-white hover:bg-white/15 transition-colors text-sm font-bold"
            aria-label={locale === "en" ? "Previous month" : "Prethodni mesec"}
          >
            ‹
          </button>

          {/* Month/year label — opens picker */}
          <button
            onClick={openPicker}
            className="min-h-8 min-w-[100px] rounded px-1 py-1 text-center text-sm font-semibold text-white transition-colors hover:bg-white/15"
            aria-label={locale === "en" ? "Select month and year" : "Izaberi mesec i godinu"}
            aria-expanded={pickerOpen}
            aria-controls="calendar-picker"
          >
            {t(`months.${viewMonth}`)} {viewYear}
          </button>

          <button
            onClick={nextMonth}
            className="h-8 w-7 flex items-center justify-center rounded text-white hover:bg-white/15 transition-colors text-sm font-bold"
            aria-label={locale === "en" ? "Next month" : "Sledeći mesec"}
          >
            ›
          </button>
        </div>

        {/* Floating month/year picker */}
        {pickerOpen && (
          <div
            ref={pickerRef}
            id="calendar-picker"
            role="group"
            aria-label={locale === "en" ? "Choose month and year" : "Izaberi mesec i godinu"}
            className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl z-[var(--z-dropdown)] p-3 flex flex-col gap-2.5"
          >
            {/* Year nav */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPickerYear(y => y - 1)}
                className="h-11 w-11 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--ink)] text-sm font-bold transition-colors"
                aria-label={locale === "en" ? "Previous year" : "Prethodna godina"}
              >
                ‹
              </button>
              <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-base text-[var(--ink)]">
                {pickerYear}
              </span>
              <button
                onClick={() => setPickerYear(y => y + 1)}
                className="h-11 w-11 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--ink)] text-sm font-bold transition-colors"
                aria-label={locale === "en" ? "Next year" : "Sledeća godina"}
              >
                ›
              </button>
            </div>

            {/* Month grid 4×3 */}
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => {
                const isActive = i === viewMonth && pickerYear === viewYear;
                const isTodayMonth = i === today.getMonth() && pickerYear === today.getFullYear();
                return (
                  <button
                    key={i}
                    onClick={() => selectMonth(i)}
                    className={[
                      "min-h-11 rounded text-xs font-semibold uppercase tracking-wide transition-colors",
                      isActive
                        ? "bg-[var(--brand-primary)] text-white"
                        : isTodayMonth
                        ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] font-bold"
                        : "text-[var(--ink)] hover:bg-[var(--surface)]",
                    ].join(" ")}
                  >
                    {t(`months.${i}`).slice(0, 3)}
                  </button>
                );
              })}
            </div>

            {/* Reset to current */}
            <button
              onClick={goToCurrent}
              className="min-h-11 border-t border-[var(--border)] pt-2 text-xs font-semibold text-[var(--brand-primary)] hover:underline text-center transition-colors"
            >
              {locale === "en" ? "↩ Current month" : "↩ Tekući mesec"}
            </button>
          </div>
        )}
      </div>

      {currentState === "loading" ? (
        <div aria-busy="true" className="flex h-72 items-center justify-center p-3 text-sm text-[var(--muted)]">{common("loading")}</div>
      ) : currentState === "error" ? (
        <div role="alert" className="flex h-72 flex-col items-center justify-center gap-3 p-3 text-center text-sm">
          <p className="text-[var(--muted)]">{common("error")}</p>
          <button type="button" onClick={() => void loadMonth(viewYear, viewMonth)} className="font-semibold text-[var(--brand-primary)] hover:underline">{common("retry")}</button>
        </div>
      ) : <div className="p-3 flex flex-col gap-2">
        <div ref={viewportRef} className="overflow-x-clip touch-pan-y" style={{ height: panelHeight }} {...swipeHandlers}>
          <div
            className="flex items-start"
            style={{
              transform: `translateX(calc(-100% + ${dragX}px))`,
              transition: settling ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none",
            }}
          >
            {panels.map(({ offset, year, month }) => (
              <div key={offset} ref={offset === 0 ? activePanelRef : undefined} className="flex w-full shrink-0 flex-col gap-2" inert={offset !== 0} aria-hidden={offset !== 0 ? true : undefined}>
                {renderMonth(year, month, offset === 0)}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between gap-1 pt-2 border-t border-[var(--border)]">
          {[
            { label: t("legend.world"),       color: LEVEL_DOT_COLOR["world"] },
            { label: t("legend.continental"), color: LEVEL_DOT_COLOR["continental"] },
            { label: t("legend.international"), color: LEVEL_DOT_COLOR["international"] },
            { label: t("legend.national"),    color: LEVEL_DOT_COLOR["national"] },
            { label: t("legend.other"),       color: LEVEL_DOT_COLOR["regional"] },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: l.color }}
              />
              <span className="text-xs leading-none text-[var(--muted)] font-semibold">
                {l.label}
              </span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}
