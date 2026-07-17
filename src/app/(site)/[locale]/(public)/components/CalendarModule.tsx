"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { getLevelLabel, LEVEL_DOT_COLOR, LEVEL_STYLE } from "@/lib/competition-utils";

interface Competition {
  id: number;
  name: string;
  date: string;
  location: string | null;
  level: string;
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

export function CalendarModule({ competitions }: CalendarModuleProps) {
  const t = useTranslations("calendar");
  const common = useTranslations("common");
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();

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

  const loadMonth = useCallback(async (year: number, month: number) => {
    const key = `${year}-${month}`;
    if (Object.hasOwn(monthCache, key)) return;
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
    } catch {
      setMonthState((states) => ({ ...states, [key]: "error" }));
    } finally {
      clearTimeout(timeout);
    }
  }, [locale, monthCache, scope]);

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

  const goToCurrent = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setPickerOpen(false);
  };

  const compsByDate = useMemo(() => {
    const map = new Map<string, Competition[]>();
    for (const c of monthCache[`${viewYear}-${viewMonth}`] ?? []) {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date)!.push(c);
    }
    return map;
  }, [monthCache, viewMonth, viewYear]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedComps = selectedDate ? (compsByDate.get(selectedDate) ?? []) : [];
  const currentMonthKey = `${viewYear}-${viewMonth}`;
  const currentState = monthState[currentMonthKey] ?? "loading";

  const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      {/* Header */}
      <div className="relative flex items-center justify-between rounded-t-xl bg-[var(--brand-primary)] px-4 py-1">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold uppercase tracking-wider text-white">
          {t("title")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="h-11 w-11 flex items-center justify-center rounded text-white hover:bg-white/15 transition-colors text-sm font-bold"
            aria-label={locale === "en" ? "Previous month" : "Prethodni mesec"}
          >
            ‹
          </button>

          {/* Month/year label — opens picker */}
          <button
            onClick={openPicker}
            className="min-w-[110px] rounded px-2 py-1 text-center text-sm font-semibold text-white transition-colors hover:bg-white/15"
            aria-label={locale === "en" ? "Select month and year" : "Izaberi mesec i godinu"}
            aria-expanded={pickerOpen}
            aria-controls="calendar-picker"
          >
            {t(`months.${viewMonth}`)} {viewYear}
          </button>

          <button
            onClick={nextMonth}
            className="h-11 w-11 flex items-center justify-center rounded text-white hover:bg-white/15 transition-colors text-sm font-bold"
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
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const comps = compsByDate.get(dateStr) ?? [];
            const isToday =
              day === today.getDate() &&
              viewMonth === today.getMonth() &&
              viewYear === today.getFullYear();
            const hasComp = comps.length > 0;

            return (
              <div
                key={dateStr}
                className="relative"
                onMouseLeave={() => setSelectedDate((value) => value === dateStr ? null : value)}
              >
                <button
                  type="button"
                  onClick={() => hasComp && setSelectedDate((value) => value === dateStr ? null : dateStr)}
                  onFocus={() => hasComp && setSelectedDate(dateStr)}
                  onMouseEnter={() => hasComp && setSelectedDate(dateStr)}
                  aria-expanded={hasComp ? selectedDate === dateStr : undefined}
                  aria-describedby={hasComp && selectedDate === dateStr ? `calendar-events-${dateStr}` : undefined}
                  aria-label={hasComp ? `${dateStr}: ${t("competitionPlural", { count: comps.length })}` : dateStr}
                  disabled={!hasComp}
                  className={[
                    "relative flex min-h-11 w-full items-center justify-center rounded-md py-1.5 text-base font-semibold transition-colors select-none",
                    isToday
                      ? "bg-[var(--brand-primary)] text-white font-bold ring-2 ring-[var(--brand-primary)] ring-offset-1"
                    : hasComp
                      ? "bg-[var(--brand-primary)]/10 text-[var(--ink)] hover:bg-[var(--brand-primary)]/20 cursor-pointer"
                      : "cursor-default text-[var(--ink)]",
                  ].join(" ")}
                >
                  {day}
                  {hasComp && !isToday && (
                    <span
                      className="absolute bottom-1.5 h-1 w-1 rounded-full"
                      style={{ background: getLevelColor(comps[0].level) }}
                    />
                  )}
                </button>

                {/* Tooltip */}
                {selectedDate === dateStr && selectedComps.length > 0 && (
                  <div
                    id={`calendar-events-${dateStr}`}
                    className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg bg-[var(--ink)] p-2.5 text-xs text-white"
                  >
                    {selectedComps.map((c) => {
                      const levelStyle = LEVEL_STYLE[c.level.toLowerCase()] ?? LEVEL_STYLE.club;
                      return <div key={c.id} className="flex flex-col gap-1 py-1 border-b border-white/10 last:border-0">
                        <span className="self-start rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={levelStyle}>
                          {getLevelLabel(c.level.toLowerCase(), locale)}
                        </span>
                        <span className="font-semibold leading-tight">{c.name}</span>
                        {c.location && (
                          <span className="text-white/80">{c.location}</span>
                        )}
                      </div>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {compsByDate.size === 0 && <p className="py-2 text-center text-sm text-[var(--muted)]">{t("noEvents")}</p>}

        {/* Legend */}
        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)] flex-wrap">
          {[
            { label: t("legend.world"),       color: LEVEL_DOT_COLOR["world"] },
            { label: t("legend.continental"), color: LEVEL_DOT_COLOR["continental"] },
            { label: t("legend.national"),    color: LEVEL_DOT_COLOR["national"] },
            { label: t("legend.other"),       color: LEVEL_DOT_COLOR["regional"] },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: l.color }}
              />
              <span className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wide">
                {l.label}
              </span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}
