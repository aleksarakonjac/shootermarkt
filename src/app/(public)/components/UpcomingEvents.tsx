"use client";

import { useRef, useState } from "react";
import Link from "next/link";

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

function getLevelBadge(level: string): { label: string; bg: string; text: string } {
  const l = level.toLowerCase();
  if (l.includes("svetsk") || l.includes("world"))
    return { label: "WC", bg: "var(--brand-primary)", text: "white" };
  if (l.includes("evropsk") || l.includes("europ"))
    return { label: "EC", bg: "var(--brand-accent)", text: "white" };
  if (l.includes("državno") || l.includes("national"))
    return { label: "DR", bg: "var(--success)", text: "white" };
  return { label: "LK", bg: "var(--warning)", text: "white" };
}

function formatDateSr(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.toLocaleString("sr-RS", { month: "short" }).toUpperCase().replace(".", ""),
    weekday: d.toLocaleString("sr-RS", { weekday: "short" }).toUpperCase().replace(".", ""),
    year: d.getFullYear(),
  };
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Danas";
  if (diff === 1) return "Sutra";
  if (diff < 0) return null;
  return `Za ${diff} dana`;
}

export function UpcomingEvents({ competitions }: UpcomingEventsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft ?? 0));
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeft - (x - startX);
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
        <div className="flex items-baseline gap-3">
          <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider text-[var(--ink)]">
            Predstojeća Takmičenja
          </h2>
          <span className="text-[10px] font-bold text-white bg-[var(--brand-primary)] px-2 py-0.5 rounded-full">
            {competitions.length} najavljeno
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/takmicenja"
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline mr-2"
          >
            Sva →
          </Link>
          {/* Scroll buttons */}
          <button
            onClick={() => scrollBy("left")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface)] text-[var(--ink)] transition-colors text-base font-bold"
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy("right")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface)] text-[var(--ink)] transition-colors text-base font-bold"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      </div>

      {/* Horizontal scrollable carousel */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        className="flex gap-3 overflow-x-auto pb-2 select-none"
        style={{
          scrollbarWidth: "none",
          cursor: isDragging ? "grabbing" : "grab",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {competitions.map((comp) => {
          const date = formatDateSr(comp.date);
          const badge = getLevelBadge(comp.level);
          const countdown = daysUntil(comp.date);

          return (
            <div
              key={comp.id}
              className="shrink-0 w-[230px] rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
            >
              {/* Top accent bar */}
              <div className="h-1" style={{ background: badge.bg }} />

              <div className="p-4 flex flex-col gap-3 flex-1">
                {/* Date block + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex flex-col items-center justify-center w-11 h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-[family-name:var(--font-barlow-condensed)] leading-none shrink-0"
                    >
                      <span className="text-[9px] font-bold uppercase text-[var(--muted)]">
                        {date.month}
                      </span>
                      <span className="text-xl font-extrabold text-[var(--ink)]">
                        {date.day}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[var(--muted)] font-semibold uppercase tracking-wider">
                        {date.weekday} · {date.year}
                      </span>
                      {countdown && (
                        <span
                          className="text-[10px] font-bold mt-0.5"
                          style={{ color: badge.bg }}
                        >
                          {countdown}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded text-white shrink-0 mt-0.5"
                    style={{ background: badge.bg }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Competition name */}
                <div className="flex flex-col gap-0.5">
                  <h4
                    className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm text-[var(--ink)] leading-snug line-clamp-2"
                    title={comp.name}
                  >
                    {comp.name}
                  </h4>
                  {comp.location && (
                    <p className="text-[10px] text-[var(--muted)] flex items-center gap-1 truncate">
                      <span>📍</span>
                      {comp.location}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-auto pt-2 border-t border-[var(--border)]">
                  <span className="text-[9px] text-[var(--subtle)] uppercase tracking-wider font-semibold">
                    {comp.level}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
