"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";

export interface TickerDetailItem {
  label?: string;
  text: string;
}

export interface TickerItem {
  id: number;
  name: string;
  date: string;
  endDate?: string;
  location?: string;
  level: string;
  status: "LIVE" | "NAJAVA";
  detailText?: string;
  detailItems?: TickerDetailItem[];
  href?: string;
  nocCode?: string;
  countryCode2?: string;
}

// ── Demo data — remove once real LIVE data flows ─────────────────────────────
const DEMO_LIVE: TickerItem = {
  id: -1,
  name: "Državno Prvnestvo — Vazdušna Puška",
  date: new Date().toISOString().split("T")[0],
  endDate: "2026-07-09",
  location: "Beograd",
  level: "national",
  status: "LIVE",
  detailItems: [
    { text: "1. Petrović 634.2" },
    { label: "2.", text: "Jovanović 632.8" },
    { label: "Finale", text: "14:30" },
  ],
  nocCode: "SRB",
  countryCode2: "rs",
};

const DEMO_UPCOMING: TickerItem[] = [
  {
    id: -2,
    name: "Kup Srbije — Vazdušni Pištolj",
    date: "2026-07-12",
    level: "Kup",
    status: "NAJAVA",
    detailText: "Beograd",
    href: "/takmicenja",
  },
  {
    id: -3,
    name: "Otvoreno Prvnestvo Vojvodine",
    date: "2026-07-19",
    level: "Regionalno",
    status: "NAJAVA",
    detailText: "Novi Sad",
    href: "/takmicenja",
  },
  {
    id: -4,
    name: "Kup Vojvodine",
    date: "2026-08-02",
    level: "Kup",
    status: "NAJAVA",
    detailText: "Subotica",
    href: "/takmicenja",
  },
];
// ─────────────────────────────────────────────────────────────────────────────

export function Ticker({
  liveItems,
  upcomingItems,
}: {
  liveItems: TickerItem[];
  upcomingItems: TickerItem[];
}) {
  const live     = liveItems[0] ?? DEMO_LIVE;
  const upcoming = upcomingItems.length > 0 ? upcomingItems : DEMO_UPCOMING;

  // Demo: always show live bar. Production: change to `liveItems.length > 0`
  const showLive = true;

  if (!showLive && upcoming.length === 0) return null;

  return (
    <div
      className="w-full"
      style={{
        borderTop:    "2px solid var(--brand-primary)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {showLive && <LiveBar item={live} />}
      {upcoming.length > 0 && <UpcomingBar items={upcoming} />}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end?: string): string {
  const s = new Date(start + "T00:00:00");
  const fmt = (d: Date, showMonth: boolean) =>
    d.getDate() + (showMonth ? ". " + d.toLocaleDateString("sr-Latn-RS", { month: "short" }) : "");

  if (!end || end === start) {
    return fmt(s, true) + ".";
  }
  const e = new Date(end + "T00:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return fmt(s, !sameMonth) + "–" + fmt(e, true) + ".";
}

// ── Live detail rotator ───────────────────────────────────────────────────────

function LiveDetail({ item }: { item: TickerItem }) {
  const items: TickerDetailItem[] = item.detailItems?.length
    ? item.detailItems
    : item.detailText
    ? [{ text: item.detailText }]
    : [];

  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % items.length);
        setVisible(true);
      }, 350);
    }, 4000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[idx];

  return (
    <span
      className="shrink-0 flex items-center gap-1.5"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        minWidth: 80,
      }}
    >
      {current.label && (
        <span
          className="font-extrabold uppercase"
          style={{ fontSize: 9, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}
        >
          {current.label}
        </span>
      )}
      <span
        className="font-bold"
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 11,
          color: "rgba(255,255,255,0.9)",
        }}
      >
        {current.text}
      </span>
    </span>
  );
}

// ── Live bar ─────────────────────────────────────────────────────────────────

function LiveBar({ item }: { item: TickerItem }) {
  const inner = (
    <div className="mx-auto max-w-7xl px-4 h-full flex items-center justify-start gap-3 min-w-0">

      {/* UŽIVO badge — box static, only dot + text pulse */}
      <span
        className="inline-flex items-center gap-1.5 shrink-0 font-extrabold select-none rounded px-1.5"
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "var(--brand-primary)",
          background: "white",
          height: 20,
        }}
      >
        <span
          className="rounded-full shrink-0"
          style={{
            width: 5, height: 5,
            background: "var(--brand-primary)",
            display: "inline-block",
            animation: "ticker-pulse 1.4s ease-in-out infinite",
          }}
        />
        UŽIVO
      </span>

      {/* Divider */}
      <span
        className="shrink-0"
        style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)", display: "inline-block" }}
        aria-hidden="true"
      />

      {/* Level + country — single white box */}
      {(() => {
        const s = LEVEL_STYLE[item.level] ?? { background: "var(--surface)", color: "var(--ink)" };
        return (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded px-1.5"
            style={{ background: "white", height: 20 }}
          >
            {/* Level inner badge */}
            <span
              className="inline-flex items-center rounded font-extrabold uppercase px-1 h-full"
              style={{ fontSize: 11, letterSpacing: "0.06em", background: s.background, color: s.color }}
            >
              {LEVEL_LABEL[item.level] ?? item.level}
            </span>

            {/* Flag + NOC */}
            {item.countryCode2 && (
              <>
                <span style={{ color: "rgba(0,0,0,0.2)", fontSize: 9 }}>·</span>
                <span
                  className={`fi fi-${item.countryCode2.toLowerCase()}`}
                  style={{ fontSize: 11, borderRadius: 2 }}
                />
                {item.nocCode && (
                  <span
                    className="font-bold"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--ink)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {item.nocCode}
                  </span>
                )}
              </>
            )}
          </span>
        );
      })()}

      {/* Name + detail — left-aligned group, name truncates */}
      <span className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className="font-semibold text-xs truncate min-w-0"
          style={{ color: "white" }}
        >
          {item.name}
        </span>

        <span
          className="shrink-0"
          style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)", display: "inline-block" }}
          aria-hidden="true"
        />

        <LiveDetail item={item} />
      </span>

      {/* Arrow affordance */}
      {item.href && (
        <span
          className="shrink-0"
          style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}
          aria-hidden="true"
        >
          →
        </span>
      )}

      {/* Date + location — right, muted */}
      {(item.location || item.endDate) && (
        <span className="hidden md:flex items-center gap-1.5 shrink-0 ml-auto pl-3">
          {item.location && (
            <span
              style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", fontWeight: 600 }}
            >
              {item.location}
            </span>
          )}
          {item.location && item.date && (
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>·</span>
          )}
          {item.date && (
            <span
              style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", fontWeight: 600 }}
            >
              {formatDateRange(item.date, item.endDate)}
            </span>
          )}
        </span>
      )}

    </div>
  );

  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: 32, background: "var(--brand-primary)" }}
      role="status"
      aria-label={`Uživo: ${item.name}`}
    >
      {item.href ? (
        <Link href={item.href} className="block h-full hover:opacity-90 transition-opacity">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

// ── Upcoming bar ─────────────────────────────────────────────────────────────

function UpcomingBar({ items }: { items: TickerItem[] }) {
  const [paused, setPaused] = useState(false);
  // Duplicate for seamless loop; -50% lands exactly at start of copy 2
  const doubled = [...items, ...items];
  const duration = Math.max(items.length * 14, 40);

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        height:     32,
        background: "var(--surface-2)",
        borderTop:  "1px solid var(--border)",
      }}
      role="region"
      aria-label="Najava takmičenja"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="h-full flex items-center">

        {/* Static label — left, outside scroll */}
        <span
          className="shrink-0 font-bold uppercase pl-4 pr-3"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--muted)" }}
        >
          Najava
        </span>
        <span
          className="shrink-0"
          style={{ width: 1, height: 10, background: "var(--border)", display: "inline-block" }}
          aria-hidden="true"
        />

        {/* Marquee track */}
        <div className="flex-1 overflow-hidden min-w-0">
          <div
            className="flex items-center"
            style={{
              animation: `ticker-scroll ${duration}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
              width: "max-content",
            }}
          >
            {doubled.map((item, i) => (
              <div key={`${item.id}-${i}`} className="flex items-center shrink-0">
                <span
                  className="px-3 shrink-0"
                  style={{ color: "var(--border)", fontSize: 13, lineHeight: 1, userSelect: "none" }}
                  aria-hidden="true"
                >
                  ·
                </span>
                <UpcomingItem item={item} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function UpcomingItem({ item }: { item: TickerItem }) {
  const d       = new Date(item.date + "T00:00:00");
  const dateStr = d.toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short" });

  const content = (
    <span className="flex items-center gap-1.5">
      <span
        className="font-bold shrink-0"
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize:   10,
          color:      "var(--muted)",
        }}
      >
        {dateStr}
      </span>
      <span
        className="font-medium whitespace-nowrap"
        style={{ fontSize: 11, color: "var(--ink)" }}
      >
        {item.name}
      </span>
    </span>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="hover:opacity-70 transition-opacity"
      >
        {content}
      </Link>
    );
  }
  return content;
}
