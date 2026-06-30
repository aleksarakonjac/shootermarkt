"use client";

import { useState, useMemo } from "react";

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

const MONTHS_SR = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];
const DAYS_SR = ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  // Monday-first: 0=Mon ... 6=Sun
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

function getLevelColor(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("svetsk") || l.includes("world")) return "var(--brand-primary)";
  if (l.includes("evropsk") || l.includes("europ")) return "var(--brand-accent)";
  if (l.includes("državno") || l.includes("national")) return "var(--success)";
  return "var(--warning)";
}

export function CalendarModule({ competitions }: CalendarModuleProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Map competition dates to quick lookup
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

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const hoveredComps = hoveredDate ? (compsByDate.get(hoveredDate) ?? []) : [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--brand-accent)] px-4 py-3 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
          Kalendar Takmičenja
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold"
            aria-label="Prethodni mesec"
          >
            ‹
          </button>
          <span className="text-white font-semibold text-sm min-w-[110px] text-center">
            {MONTHS_SR[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold"
            aria-label="Sledeći mesec"
          >
            ›
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_SR.map((d) => (
            <div
              key={d}
              className="text-center text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] py-1"
            >
              {d}
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
                      ? "bg-[var(--brand-accent)]/10 text-[var(--ink)] hover:bg-[var(--brand-accent)]/20 cursor-pointer"
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
            { label: "Svetsko", color: "var(--brand-primary)" },
            { label: "Evropsko", color: "var(--brand-accent)" },
            { label: "Državno", color: "var(--success)" },
            { label: "Ostalo", color: "var(--warning)" },
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
