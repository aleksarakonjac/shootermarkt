"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "react-calendar";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { startNavigationProgress } from "@/components/NavigationProgress";
import { CalendarDayEvents } from "../../components/CalendarDayEvents";
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
  name: string;
  location: string | null;
  countryName: string | null;
  countryCode2: string | null;
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

function formatPeekDay(key: string, locale: string) {
  return new Date(key + "T00:00:00").toLocaleDateString(locale === "en" ? "en-GB" : "sr-Latn", { day: "numeric", month: "long" });
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
const PEEK_W = 224; // širina prozora za dan (w-56)
const PEEK_CLOSE_MS = 120;

type Peek = { key: string; left: number; top: number; width: number; pinned: boolean; ctx: string };

// Pronalazi redove u listi čiji period obuhvata dan, skroluje do prvog i kratko ih istakne.
function focusDayInList(key: string): boolean {
  const matches = [...document.querySelectorAll<HTMLElement>("[data-comp-start]")]
    .filter((el) => el.dataset.compStart! <= key && (el.dataset.compEnd ?? el.dataset.compStart!) >= key);
  if (matches.length === 0) return false;
  // Red može biti u sažetom mesecu (<details>): otvori ga pre skrola.
  for (const el of matches) el.closest("details")?.setAttribute("open", "");
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
  const locale = useLocale();

  const [view, setView] = useState<CalendarView>("month");
  const monthBeforeYear = useRef(0);
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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

  // Prozor sa takmičenjima dana: desktop na hover, telefon (bez hovera) na tap. Pozicija ispod polja, unutar korena.
  const rootRef = useRef<HTMLDivElement>(null);
  const [rawPeek, setPeek] = useState<Peek | null>(null);
  // Prozor važi samo za mesec/prikaz u kom je otvoren; promena meseca ga sakriva.
  const peekCtx = `${activeStartDate.getTime()}|${view}|${open}`;
  const peek = rawPeek?.ctx === peekCtx ? rawPeek : null;
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function peekAt(tile: Element, key: string, pinned: boolean) {
    const root = rootRef.current;
    if (!root) return;
    window.clearTimeout(closeTimer.current);
    const rr = root.getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    const top = tr.bottom - rr.top + 6;
    // Telefon (zakačen): cela širina kalendara; desktop: uzak prozor centriran ispod polja.
    if (pinned) { setPeek({ key, left: 0, top, width: rr.width, pinned, ctx: peekCtx }); return; }
    const left = Math.min(Math.max(tr.left - rr.left + tr.width / 2 - PEEK_W / 2, 0), Math.max(rr.width - PEEK_W, 0));
    setPeek({ key, left, top, width: PEEK_W, pinned, ctx: peekCtx });
  }
  function closePeekSoon() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPeek((p) => (p?.pinned ? p : null)), PEEK_CLOSE_MS);
  }
  const tileKey = (target: EventTarget) => {
    const tile = (target as Element).closest?.(".react-calendar__tile");
    const key = tile?.querySelector<HTMLElement>("[data-day]")?.dataset.day;
    return tile && key ? { tile, key } : null;
  };

  // Zakačen prozor (telefon): zatvara ga tap van njega, Escape ili promena meseca.
  const pinned = peek?.pinned ?? false;
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element;
      if (el.closest?.(".cal-peek") || el.closest?.(".react-calendar__tile")) return;
      setPeek(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPeek(null); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [pinned]);

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
    // Ponovni klik na isti dan: zatvori prozor i poništi izbor.
    if (key === selectedDay) { setSelectedDay(null); setPeek(null); return; }
    // Telefon (bez hovera) i dan bez takmičenja: prozor uz dan, kalendar ostaje otvoren.
    if (!eventMap.has(key) || window.matchMedia("(hover: none)").matches) {
      const tile = rootRef.current?.querySelector(`[data-day="${key}"]`)?.closest(".react-calendar__tile");
      if (tile) { setSelectedDay(key); peekAt(tile, key, true); return; }
    }
    jumpToDay(key);
  }

  function jumpToDay(key: string) {
    setPeek(null);
    setOpen(false);
    setSelectedDay(key);
    if (focusDayInList(key)) return;
    // Dan postoji, ali nije u trenutnoj listi: prebaci godinu pa istakni.
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", key.slice(0, 4));
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
    <div ref={rootRef} className="relative w-full lg:sticky lg:top-[calc(var(--site-header-h,3.5rem)+1.5rem)]">
      {/* Telefon: traka u stilu kalendara sa početne. Zatvorena: klik bilo gde je otvara. Otvorena: mesec, Danas, strelice */}
      <div
        onClick={() => { if (!open) setOpen(true); }}
        className={`flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] pl-3 pr-1 lg:hidden ${open ? "" : "cursor-pointer"}`}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          aria-expanded={open}
          aria-controls="competition-calendar-grid"
          className="flex min-h-11 min-w-0 items-center gap-1.5 text-white"
        >
          {open
            ? <span className="truncate text-sm font-semibold">{monthLabel}</span>
            : <span className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold uppercase tracking-wider leading-none">{t("title")}</span>}
          <svg className="cal-strip-chevron shrink-0 text-white/80" data-open={open} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        <div className="flex min-w-0 flex-1 justify-center">
          {open && !showingCurrentMonth && (
            <button
              type="button"
              onClick={goToday}
              className="rounded border border-white/60 px-2 py-px text-[11px] font-semibold uppercase leading-4 tracking-wide text-white transition-colors hover:bg-white/15"
            >
              {t("goToday")}
            </button>
          )}
        </div>
        {open && (
          <div className="flex items-center">
            <button type="button" className="cal-strip-btn !text-white hover:!bg-white/15" onClick={() => shift(-1)} aria-label={t("prevMonth")}><Arrow dir="prev" /></button>
            <button type="button" className="cal-strip-btn !text-white hover:!bg-white/15" onClick={() => shift(1)} aria-label={t("nextMonth")}><Arrow dir="next" /></button>
          </div>
        )}
      </div>

      <div id="competition-calendar-grid" className="cal-collapse mt-2 lg:mt-0" data-open={open}>
        <div>
          <div
            className={`relative ${showingCurrentMonth ? "" : "cal-has-today"}`}
            onPointerOver={(e) => {
              if (e.pointerType !== "mouse") return;
              const hit = tileKey(e.target);
              if (hit && eventMap.has(hit.key)) peekAt(hit.tile, hit.key, false);
              else closePeekSoon();
            }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") closePeekSoon(); }}
          >
          {/* Desktop: povratak na tekući mesec, u zaglavlju kalendara (ispod reda sa strelicama) */}
          {!showingCurrentMonth && (
            <button type="button" onClick={goToday} className="cal-today-btn absolute left-1/2 z-10 hidden -translate-x-1/2 rounded border border-[var(--brand-primary)] px-2 py-px text-[11px] font-semibold uppercase leading-4 tracking-wide text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/10 lg:block">
              {t("goToday")}
            </button>
          )}
          <SwipeArea onShift={shift} className="kalendar-swipe touch-pan-y">
            <Calendar
              value={selectedDay ? new Date(selectedDay + "T00:00:00") : null}
              onChange={(val) => pickDay(val as Date | null)}
              activeStartDate={activeStartDate}
              view={view}
              // Klik na labelu u godišnjem prikazu zatvara selektor: nazad na mesec (decade prikaz nam ne treba).
              onViewChange={({ view: next, action }) => {
                if (!next) return;
                if (action === "drillUp" && next === "decade") {
                  setView("month");
                  setActiveStartDate((cur) => new Date(cur.getFullYear(), monthBeforeYear.current, 1));
                } else {
                  if (action === "drillUp" && next === "year") monthBeforeYear.current = activeStartDate.getMonth();
                  setView(next as CalendarView);
                }
              }}
              onActiveStartDateChange={({ activeStartDate: d, action }) => {
                if (d && !(action === "drillUp" && view === "year")) setActiveStartDate(d);
              }}
              formatDay={(_, date) => String(date.getDate())}
              formatMonthYear={(_, date) => `${t(`months.${date.getMonth()}`)} ${date.getFullYear()}`}
              formatMonth={(_, date) => t(`months.${date.getMonth()}`)}
              formatShortWeekday={(_, date) => t(`weekdays.${date.getDay()}`)}
              tileContent={({ date, view: tileView }) => {
                if (tileView !== "month") return null;
                const dayComps = eventMap.get(toKey(date));
                if (!dayComps?.length) return <span hidden data-day={toKey(date)} />;
                const sorted = dayComps.toSorted((x, y) => levelRank(x.level) - levelRank(y.level));
                const shown = sorted.slice(0, MAX_DOTS);
                return (
                  <span className="tile-dots" aria-hidden="true" data-day={toKey(date)}>
                    {shown.map((c) => <span key={c.id} className="tile-dot" style={{ background: `var(--level-${c.level}-fg)` }} />)}
                    {sorted.length > shown.length && <span className="tile-dot-more">+</span>}
                  </span>
                );
              }}
              calendarType="iso8601"
              minDetail="decade"
              className="shadow-sm"
            />
          </SwipeArea>
          </div>
        </div>
      </div>
      {peek && (
        <div
          role="dialog"
          aria-label={formatPeekDay(peek.key, locale)}
          className="cal-peek absolute z-50 max-h-[60vh] overflow-y-auto overscroll-contain rounded-lg bg-[oklch(0.22_0.012_28)] p-2.5 text-xs text-white shadow-lg"
          style={{ left: peek.left, top: peek.top, width: peek.width }}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") window.clearTimeout(closeTimer.current); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") closePeekSoon(); }}
        >
          {peek.pinned && eventMap.has(peek.key) && (
            <div className="mb-1 flex items-center justify-between gap-2 border-b border-white/15 pb-1.5">
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-semibold text-white/70">{formatPeekDay(peek.key, locale)}</span>
              <button
                type="button"
                onClick={() => jumpToDay(peek.key)}
                className="min-h-8 rounded px-1.5 text-[11px] font-semibold text-white underline-offset-2 hover:underline"
              >
                {locale === "en" ? "Show in list" : "Prikaži u listi"}
              </button>
            </div>
          )}
          {eventMap.has(peek.key)
            ? <CalendarDayEvents comps={eventMap.get(peek.key)!.map((c) => ({ ...c, endDate: c.dateEnd }))} locale={locale} />
            : <p role="status" className="py-0.5 text-white/80"><span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-white">{formatPeekDay(peek.key, locale)}</span> · {t("noEventsDay")}</p>}
        </div>
      )}
    </div>
  );
}
