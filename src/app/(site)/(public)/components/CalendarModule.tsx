"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { LEVEL_DOT_COLOR } from "@/lib/competition-utils";

interface Competition {
  id: number;
  name: string;
  date: string;
  location: string | null;
  level: string;
}

interface CalendarModuleProps {
  competitions: Competition[];
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
  const locale = useLocale();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

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
    for (const c of competitions) {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date)!.push(c);
    }
    return map;
  }, [competitions]);

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

  const hoveredComps = hoveredDate ? (compsByDate.get(hoveredDate) ?? []) : [];

  const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-[var(--brand-primary)] rounded-t-xl px-4 py-3 flex items-center justify-between relative">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
          {t("title")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold"
            aria-label={locale === "en" ? "Previous month" : "Prethodni mesec"}
          >
            ‹
          </button>

          {/* Month/year label — opens picker */}
          <button
            onClick={openPicker}
            className="text-white font-semibold text-sm min-w-[110px] text-center px-2 py-1 rounded hover:bg-white/10 transition-colors"
            aria-label={locale === "en" ? "Select month and year" : "Izaberi mesec i godinu"}
          >
            {t(`months.${viewMonth}`)} {viewYear}
          </button>

          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold"
            aria-label={locale === "en" ? "Next month" : "Sledeći mesec"}
          >
            ›
          </button>
        </div>

        {/* Floating month/year picker */}
        {pickerOpen && (
          <div
            ref={pickerRef}
            className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-xl z-[var(--z-dropdown)] p-3 flex flex-col gap-2.5"
          >
            {/* Year nav */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPickerYear(y => y - 1)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--ink)] text-sm font-bold transition-colors"
              >
                ‹
              </button>
              <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-base text-[var(--ink)]">
                {pickerYear}
              </span>
              <button
                onClick={() => setPickerYear(y => y + 1)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--surface)] text-[var(--ink)] text-sm font-bold transition-colors"
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
                      "py-1.5 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors",
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
              className="border-t border-[var(--border)] pt-2 text-[10px] font-semibold text-[var(--brand-primary)] hover:underline text-center transition-colors"
            >
              {locale === "en" ? "↩ Current month" : "↩ Tekući mesec"}
            </button>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2">
        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_ORDER.map((d) => (
            <div
              key={d}
              className="text-center text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] py-1"
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
            const isHovered = hoveredDate === dateStr;

            return (
              <div
                key={dateStr}
                className="relative"
                onMouseEnter={() => hasComp && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <div
                  className={[
                    "flex flex-col items-center justify-center rounded-md py-1.5 text-[11px] font-semibold transition-all cursor-default select-none",
                    isToday
                      ? "bg-[var(--brand-primary)] text-white font-bold ring-2 ring-[var(--brand-primary)] ring-offset-1"
                      : hasComp
                      ? "bg-[var(--brand-primary)]/10 text-[var(--ink)] hover:bg-[var(--brand-primary)]/20 cursor-pointer"
                      : "text-[var(--ink)] hover:bg-[var(--surface)]",
                  ].join(" ")}
                >
                  {day}
                  {hasComp && !isToday && (
                    <span
                      className="block w-1 h-1 rounded-full mt-0.5"
                      style={{ background: getLevelColor(comps[0].level) }}
                    />
                  )}
                </div>

                {/* Tooltip */}
                {isHovered && hoveredComps.length > 0 && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 bg-[var(--ink)] text-white rounded-lg shadow-xl p-2.5 text-[10px] pointer-events-none"
                    style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
                  >
                    {hoveredComps.map((c) => (
                      <div key={c.id} className="flex flex-col gap-0.5 py-1 border-b border-white/10 last:border-0">
                        <span
                          className="text-[8px] font-bold uppercase tracking-wider"
                          style={{ color: getLevelColor(c.level) }}
                        >
                          {c.level}
                        </span>
                        <span className="font-semibold leading-tight">{c.name}</span>
                        {c.location && (
                          <span className="text-white/60">{c.location}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
              <span className="text-[9px] text-[var(--muted)] font-semibold uppercase tracking-wide">
                {l.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
