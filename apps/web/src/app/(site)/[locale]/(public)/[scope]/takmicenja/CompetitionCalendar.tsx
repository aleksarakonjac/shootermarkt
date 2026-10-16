"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { startNavigationProgress } from "@/components/NavigationProgress";
import "./competition-calendar.css";

const MAX_DOTS = 4;
const SWIPE_DISTANCE_RATIO = 0.25;
const SWIPE_VELOCITY = 0.5; // px/ms
const SETTLE_MS = 220;

const LEVEL_ORDER = ["olympic", "world", "continental", "international", "national", "regional", "club"];
const levelRank = (level: string) => { const i = LEVEL_ORDER.indexOf(level); return i === -1 ? LEVEL_ORDER.length : i; };

type CalendarView = "month" | "year" | "decade" | "century";
type SwipeGesture = { id: number; x: number; y: number; lastX: number; lastT: number; vx: number; axis: "x" | "y" | null };

export type CalendarComp = {
  id: number;
  date: string;
  dateEnd: string | null;
  level: string;
};

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Pomeranje aktivnog perioda za jedan korak u trenutnom prikazu (mesec / godina / decenija / vek).
function shiftPeriod(date: Date, view: CalendarView, dir: 1 | -1) {
  const y = date.getFullYear();
  if (view === "month") return new Date(y, date.getMonth() + dir, 1);
  if (view === "year") return new Date(y + dir, 0, 1);
  return new Date(y + dir * (view === "decade" ? 10 : 100), 0, 1);
}

// Prati prst po horizontali; na otpuštanju klizi van, poziva onShift i novi sadržaj ulazi sa suprotne strane.
function SwipeArea({ onShift, className, children }: { onShift: (dir: 1 | -1) => void; className: string; children: React.ReactNode }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const gesture = useRef<SwipeGesture | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const shift = useRef(onShift);
  useEffect(() => { shift.current = onShift; });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const [dragX, setDragX] = useState(0);
  const [mode, setMode] = useState<"idle" | "drag" | "settle">("idle");

  const finish = (cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== "x") return;
    const width = node?.offsetWidth ?? 0;
    const passed = !cancelled && width > 0 && dragX !== 0 && (Math.abs(dragX) > width * SWIPE_DISTANCE_RATIO || Math.abs(g.vx) > SWIPE_VELOCITY);
    const dir: 1 | -1 | 0 = passed ? (dragX < 0 ? 1 : -1) : 0; // swipe levo → sledeći period
    setMode("settle");
    setDragX(dir === 0 ? 0 : -dir * width);
    timer.current = window.setTimeout(() => {
      if (dir === 0) { setMode("idle"); return; }
      shift.current(dir);
      setMode("drag");
      setDragX(dir * width);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setMode("settle");
        setDragX(0);
        timer.current = window.setTimeout(() => setMode("idle"), SETTLE_MS);
      }));
    }, SETTLE_MS);
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "touch" || mode !== "idle") return;
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
          setMode("drag");
        }
      }
      if (g.axis !== "x") return;
      const dt = e.timeStamp - g.lastT;
      if (dt > 0) g.vx = (e.clientX - g.lastX) / dt;
      g.lastX = e.clientX;
      g.lastT = e.timeStamp;
      setDragX(dx);
    },
    onPointerUp: () => finish(false),
    onPointerCancel: () => finish(true),
  };

  return (
    <div ref={setNode} className={className} data-swipe={mode} style={{ "--drag-x": `${dragX}px` } as React.CSSProperties} {...handlers}>
      {children}
    </div>
  );
}

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
      <path d={dir === "prev" ? "M7.5 2L3.5 6L7.5 10" : "M4.5 2L8.5 6L4.5 10"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

interface Props {
  competitions: CalendarComp[];
}

const FOCUS_MS = 1400;

// Pronalazi redove u listi čiji period obuhvata dan, skroluje do prvog i kratko ih istakne.
function focusDayInList(key: string): boolean {
  const matches = [...document.querySelectorAll<HTMLElement>("[data-comp-start]")]
    .filter((el) => el.dataset.compStart! <= key && (el.dataset.compEnd ?? el.dataset.compStart!) >= key);
  if (matches.length === 0) return false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  matches[0].scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  for (const el of matches) {
    el.classList.remove("comp-focus");
    void el.offsetWidth; // restart animacije
    el.classList.add("comp-focus");
    window.setTimeout(() => el.classList.remove("comp-focus"), FOCUS_MS);
  }
  return true;
}

/**
 * Mesečna mreža kao vodič kroz listu: klik na dan skroluje do tog dana u listi i ističe ga,
 * bez filtriranja. Ako dan nije u prikazanoj listi (druga godina / Prošla), prvo prebaci listu.
 * Desktop: stalno vidljiva. Telefon: traka mesec + strelice koja otvara punu mrežu.
 */
export function CompetitionCalendar({ competitions }: Props) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopedHref = useScopedHref();

  const [view, setView] = useState<CalendarView>("month");
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [emptyNote, setEmptyNote] = useState(false);
  const [activeStartDate, setActiveStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = competitions.find((c) => new Date(c.date + "T00:00:00") >= today);
    const base = next ? new Date(next.date + "T00:00:00") : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  
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

  // Dolazak sa ?focus=YYYY-MM-DD (posle prebacivanja liste): istakni dan i skloni parametar iz URL-a.
  const focusParam = searchParams.get("focus");
  useEffect(() => {
    if (!focusParam) return;
    const frame = requestAnimationFrame(() => {
      setSelectedDay(focusParam);
      focusDayInList(focusParam);
      const params = new URLSearchParams(window.location.search);
      params.delete("focus");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusParam]);

  function pickDay(day: Date | null) {
    if (!day) return;
    const key = toKey(day);
    setOpen(false);
    setEmptyNote(false);
    if (key === selectedDay) { setSelectedDay(null); return; }
    setSelectedDay(key);
    if (focusDayInList(key)) return;
    if (!eventMap.has(key)) { setEmptyNote(true); return; }
    // Dan postoji, ali nije u trenutnoj listi: prebaci godinu i Nadolazeća/Prošla pa istakni.
    const params = new URLSearchParams(searchParams.toString());
    const today = toKey(new Date());
    params.set("year", key.slice(0, 4));
    if (key < today) { params.set("when", "past"); params.set("archiveAll", "1"); }
    else { params.delete("when"); params.delete("archiveAll"); }
    params.set("focus", key);
    const href = scopedHref(`/takmicenja?${params.toString()}`);
    startNavigationProgress(href);
    router.push(href, { scroll: false });
  }

  const shift = (dir: 1 | -1) => setActiveStartDate((current) => shiftPeriod(current, view, dir));
  const monthLabel = `${t(`months.${activeStartDate.getMonth()}`)} ${activeStartDate.getFullYear()}`;
  const now = new Date();
  const showingCurrentMonth = view === "month" && activeStartDate.getFullYear() === now.getFullYear() && activeStartDate.getMonth() === now.getMonth();
  const goToday = () => {
    setView("month");
    setActiveStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="w-full lg:sticky lg:top-[calc(var(--site-header-h,3.5rem)+1.5rem)]">
      {/* Telefon: levo oznaka (zatvoreno: "Kalendar", otvoreno: mesec), desno strelice samo kad je otvoreno */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-1 pr-1 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="competition-calendar-grid"
          className="flex h-11 min-w-0 items-center gap-2 rounded-lg px-2.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <span className="truncate">{open ? monthLabel : t("title")}</span>
          <svg className="cal-strip-chevron shrink-0 text-[var(--muted)]" data-open={open} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        {open && !showingCurrentMonth && (
          <button type="button" onClick={goToday} className="h-8 shrink-0 rounded-md bg-[var(--surface-2)] px-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--border)] transition-colors">
            {t("goToday")}
          </button>
        )}
        {open && (
          <div className="ml-auto flex items-center">
            <button type="button" className="cal-strip-btn" onClick={() => shift(-1)} aria-label={t("prevMonth")}><Arrow dir="prev" /></button>
            <button type="button" className="cal-strip-btn" onClick={() => shift(1)} aria-label={t("nextMonth")}><Arrow dir="next" /></button>
          </div>
        )}
      </div>

      <div id="competition-calendar-grid" className="cal-collapse mt-2 lg:mt-0" data-open={open}>
        <div>
          <SwipeArea onShift={shift} className="kalendar-swipe touch-pan-y">
            <Calendar
              value={selectedDay ? new Date(selectedDay + "T00:00:00") : null}
              onChange={(val) => pickDay(val as Date | null)}
              activeStartDate={activeStartDate}
              view={view}
              onViewChange={({ view: next }) => { if (next) setView(next as CalendarView); }}
              onActiveStartDateChange={({ activeStartDate: d }) => { if (d) setActiveStartDate(d); }}
              formatDay={(_, date) => String(date.getDate())}
              formatMonthYear={(_, date) => `${t(`months.${date.getMonth()}`)} ${date.getFullYear()}`}
              formatMonth={(_, date) => t(`months.${date.getMonth()}`)}
              formatShortWeekday={(_, date) => t(`weekdays.${date.getDay()}`)}
              tileContent={({ date, view: tileView }) => {
                if (tileView !== "month") return null;
                const dayComps = eventMap.get(toKey(date));
                if (!dayComps?.length) return null;
                const sorted = dayComps.toSorted((x, y) => levelRank(x.level) - levelRank(y.level));
                const shown = sorted.slice(0, MAX_DOTS);
                return (
                  <span className="tile-dots" aria-hidden="true">
                    {shown.map((c) => <span key={c.id} className="tile-dot" style={{ background: `var(--level-${c.level}-fg)` }} />)}
                    {sorted.length > shown.length && <span className="tile-dot-more">+</span>}
                  </span>
                );
              }}
              calendarType="iso8601"
              minDetail="year"
              className="shadow-sm"
            />
          </SwipeArea>
        </div>
      </div>
      {/* Desktop: povratak na tekući mesec ispod mreže (ne pomera ništa iznad) */}
      {!showingCurrentMonth && (
        <div className="mt-2 hidden justify-center lg:flex">
          <button type="button" onClick={goToday} className="h-8 rounded-md bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--border)] transition-colors">
            {t("goToday")}
          </button>
        </div>
      )}
      {emptyNote && (
        <p role="status" className="mt-2 text-center text-xs text-[var(--muted)]">{t("noEventsDay")}</p>
      )}
    </div>
  );
}
