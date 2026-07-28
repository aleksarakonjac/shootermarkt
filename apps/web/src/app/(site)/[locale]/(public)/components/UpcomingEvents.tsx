"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { MapPin } from "lucide-react";
import { LEVEL_STYLE } from "@/lib/competition-utils";
import { useScopedHref } from "@/hooks/use-scoped-href";

interface Competition {
  id: number;
  name: string;
  date: string;
  location: string | null;
  level: string;
}

interface UpcomingEventsProps {
  competitions: Competition[];
}

const FALLBACK_LEVEL_STYLE = { background: "var(--level-club-bg)", color: "var(--level-club-fg)" };

function getLevelStyle(level: string) {
  return LEVEL_STYLE[level.toLowerCase()] ?? FALLBACK_LEVEL_STYLE;
}

function formatDate(iso: string, locale: string) {
  const d = new Date(iso);
  const localeStr = locale === "en" ? "en-US" : "sr-Latn-RS";
  return {
    day: d.getDate(),
    month: d.toLocaleString(localeStr, { month: "short" }).toUpperCase().replace(".", ""),
    weekday: d.toLocaleString(localeStr, { weekday: "short" }).toUpperCase().replace(".", ""),
    year: d.getFullYear(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function daysUntil(iso: string, t: any) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return t("today");
  if (diff === 1) return t("tomorrow");
  if (diff < 0) return null;
  return t("daysCount", { count: diff });
}

export function UpcomingEvents({ competitions }: UpcomingEventsProps) {
  const t = useTranslations("home");
  const tComp = useTranslations("competition");
  const locale = useLocale();
  const scopedHref = useScopedHref();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const checkBounds = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  useEffect(() => {
    checkBounds();
  }, [competitions]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft ?? 0));
    setScrollLeftPos(scrollRef.current?.scrollLeft ?? 0);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeftPos - (x - startX);
  };
  const stopDrag = () => setIsDragging(false);

  const scrollBy = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 260 : -260, behavior: "smooth" });
  };

  if (!competitions || competitions.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl leading-none uppercase tracking-wider text-[var(--ink)] whitespace-nowrap">
            {t("upcomingEvents")}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={scopedHref("/takmicenja")}
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline mr-2"
          >
            {t("all")}
          </Link>
          <button
            onClick={() => scrollBy("left")}
            disabled={atStart}
            className={`w-11 h-11 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] transition-colors ${
              atStart ? "opacity-30 cursor-not-allowed" : "hover:bg-[var(--surface)]"
            }`}
            aria-label={t("scrollLeft")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => scrollBy("right")}
            disabled={atEnd}
            className={`w-11 h-11 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] transition-colors ${
              atEnd ? "opacity-30 cursor-not-allowed" : "hover:bg-[var(--surface)]"
            }`}
            aria-label={t("scrollRight")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Horizontal scrollable carousel */}
      <div className="relative">
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onScroll={checkBounds}
          className="-mt-1 flex gap-3 overflow-x-auto pb-2 pt-1 select-none"
          style={{ scrollbarWidth: "none", cursor: isDragging ? "grabbing" : "grab" }}
        >
          {competitions.map((comp) => {
            const date = formatDate(comp.date, locale);
            const levelStyle = getLevelStyle(comp.level);
            const countdown = daysUntil(comp.date, t);
            const levelKey = `levels.${comp.level.toLowerCase()}`;
            const levelLabel = tComp.has(levelKey) ? tComp(levelKey) : comp.level;

            return (
              <Link
                key={comp.id}
                href={scopedHref(`/takmicenja/${comp.id}`)}
                className="shrink-0 w-[230px] rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 flex flex-col no-underline"
              >
                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Date block + badge + weekday/year */}
                  <div className="flex items-stretch gap-4">
                    <div className="self-stretch shrink-0 min-w-[44px] flex">
                      <div className="h-full aspect-square flex flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] font-[family-name:var(--font-barlow-condensed)] leading-none">
                        <span className="text-sm font-bold uppercase text-[var(--muted)] -mb-1">
                          {date.month}
                        </span>
                        <span className="text-3xl font-extrabold text-[var(--ink)]">
                          {date.day}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span
                        className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded self-start"
                        style={{ background: levelStyle.background, color: levelStyle.color }}
                        title={levelLabel}
                      >
                        {levelLabel}
                      </span>
                      <span className="text-[11px] text-[var(--muted)] font-semibold uppercase tracking-wider pl-1.5">
                        {date.weekday} · {date.year}
                      </span>
                      {countdown && (
                        <span
                          className="text-xs font-bold pl-1.5"
                          style={{ color: levelStyle.color }}
                        >
                          {countdown}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Competition name */}
                  <div className="flex flex-col gap-0.5">
                    <h4
                      className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-[var(--ink)] leading-snug line-clamp-2"
                      title={comp.name}
                    >
                      {comp.name}
                    </h4>
                    {comp.location && (
                      <p className="text-xs text-[var(--muted)] flex items-center gap-1 truncate">
                        <MapPin size={11} className="shrink-0" aria-hidden="true" />
                        {comp.location}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Right edge fade — signals more cards when not at end */}
        {!atEnd && (
          <div
            className="absolute right-0 top-0 bottom-0 w-14 pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, var(--bg))" }}
          />
        )}
      </div>
    </section>
  );
}
