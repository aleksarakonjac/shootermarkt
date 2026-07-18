"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";
import { useTranslations, useLocale } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";

export interface TickerDetailItem { label?: string; text: string; }

export interface TickerItem {
  id: number;
  name: string;
  date: string;
  endDate?: string;
  location?: string;
  level: string;
  status: "LIVE" | "USKORO" | "CUSTOM";
  detailText?: string;
  detailItems?: TickerDetailItem[];
  href?: string;
  nocCode?: string;
  countryCode2?: string;
  label?: string;
}

// ── Days-before thresholds for USKORO ────────────────────────────────────────
export const USKORO_LEAD_DAYS: Record<string, number> = {
  club:          1,
  regional:      1,
  national:      1,
  international: 1,
  world:         3,
  continental:   3,
  olympic:       5,
};

// ── Main component ────────────────────────────────────────────────────────────

export function Ticker({
  liveItems = [],
  upcomingItems = [],
}: {
  liveItems?: TickerItem[];
  upcomingItems?: TickerItem[];
}) {
  const t = useTranslations("common");
  const locale = useLocale();

  // Upper bar: live + uskoro + custom
  const upperItems = liveItems;
  const upcoming   = upcomingItems;

  return (
    <div
      className="w-full"
      style={{ borderTop: "2px solid var(--brand-primary)", borderBottom: "1px solid var(--border)" }}
    >
      {upperItems.length > 0 && <UpperBar items={upperItems} live={t("live")} upcoming={t("upcoming")} locale={locale} />}
      {upcoming.length > 0 && <UpcomingBar items={upcoming} upcoming={t("upcoming")} locale={locale} />}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateRange(start: string, locale: string, end?: string): string {
  const s   = new Date(start + "T00:00:00");
  const localeStr = locale === "en" ? "en-US" : "sr-Latn-RS";
  const fmt = (d: Date, showMonth: boolean) =>
    d.getDate() + (showMonth ? ". " + d.toLocaleDateString(localeStr, { month: "short" }) : "");
  if (!end || end === start) return fmt(s, true) + ".";
  const e         = new Date(end + "T00:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return fmt(s, !sameMonth) + "–" + fmt(e, true) + ".";
}

// ── Live detail rotator ───────────────────────────────────────────────────────

function LiveDetail({ item }: { item: TickerItem }) {
  const items: TickerDetailItem[] = item.detailItems?.length
    ? item.detailItems
    : item.detailText ? [{ text: item.detailText }] : [];

  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx((i) => (i + 1) % items.length); setVisible(true); }, 350);
    }, 4000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[idx];

  return (
    <span
      className="shrink-0 flex items-center gap-1.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease", minWidth: 80 }}
    >
      {current.label && (
        <span className="font-extrabold uppercase" style={{ fontSize: 9, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}>
          {current.label}
        </span>
      )}
      <span className="font-bold" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
        {current.text}
      </span>
    </span>
  );
}

// ── Upper bar (cycles through live + uskoro + custom) ────────────────────────

function UpperBar({ items, live, upcoming, locale }: { items: TickerItem[]; live: string; upcoming: string; locale: string }) {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx((i) => (i + 1) % items.length); setVisible(true); }, 400);
    }, 6000);
    return () => clearInterval(interval);
  }, [items.length]);

  // idx is clamped in the render below — no reset effect needed

  const item = items[Math.min(idx, items.length - 1)];

  return (
    <div
      style={{
        height:     32,
        background: "var(--brand-primary)",
        opacity:    visible ? 1 : 0,
        transition: "opacity 0.4s ease",
        overflow:   "hidden",
      }}
      role="status"
      aria-label={`Ticker: ${item.name}`}
    >
      <LiveBarInner item={item} live={live} upcoming={upcoming} locale={locale} />
    </div>
  );
}

function LiveBarInner({ item, live, upcoming, locale }: { item: TickerItem; live: string; upcoming: string; locale: string }) {
  const scopedHref = useScopedHref();
  const isLive   = item.status === "LIVE";
  const isUskoro = item.status === "USKORO";

  const inner = (
    <div className="mx-auto max-w-7xl px-4 h-full flex items-center gap-3 min-w-0">

      {/* Status badge */}
      {isLive && (
        <span
          className="inline-flex items-center gap-1.5 shrink-0 font-extrabold select-none rounded px-1.5"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--brand-primary)", background: "white", height: 20 }}
        >
          <span
            className="rounded-full shrink-0"
            style={{ width: 5, height: 5, background: "var(--brand-primary)", display: "inline-block", animation: "ticker-pulse 1.4s ease-in-out infinite" }}
          />
          {live}
        </span>
      )}

      {isUskoro && (
        <span
          className="inline-flex items-center shrink-0 font-extrabold select-none rounded px-1.5"
          style={{
            fontSize: 11, letterSpacing: "0.08em",
            color: "var(--brand-primary)", background: "white", height: 20,
            animation: "ticker-pulse 2s ease-in-out infinite",
          }}
        >
          {upcoming.toUpperCase()}
        </span>
      )}

      {item.status === "CUSTOM" && item.label && (
        <span
          className="inline-flex items-center shrink-0 font-extrabold select-none rounded px-1.5"
          style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--brand-primary)", background: "white", height: 20 }}
        >
          {item.label}
        </span>
      )}

      {/* Divider */}
      <span className="shrink-0" style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)", display: "inline-block" }} aria-hidden="true" />

      {/* Level + country */}
      {(() => {
        const s = LEVEL_STYLE[item.level] ?? { background: "var(--surface)", color: "var(--ink)" };
        return (
          <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded px-1.5" style={{ background: "white", height: 20 }}>
            <span className="inline-flex items-center rounded font-extrabold uppercase px-1 h-full" style={{ fontSize: 11, letterSpacing: "0.06em", background: s.background, color: s.color }}>
              {LEVEL_LABEL[item.level] ?? item.level}
            </span>
            {item.countryCode2 && (
              <>
                <span style={{ color: "rgba(0,0,0,0.2)", fontSize: 9 }}>·</span>
                <span className={`fi fi-${item.countryCode2.toLowerCase()}`} style={{ fontSize: 11, borderRadius: 2 }} />
                {item.nocCode && (
                  <span className="font-bold" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11, fontWeight: 800, color: "var(--ink)", letterSpacing: "0.06em" }}>
                    {item.nocCode}
                  </span>
                )}
              </>
            )}
          </span>
        );
      })()}

      {/* Name + detail */}
      <span className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-semibold text-xs truncate min-w-0" style={{ color: "white" }}>
          {item.name}
        </span>

        {/* Show rotating detail only for LIVE */}
        {isLive && (item.detailItems?.length || item.detailText) && (
          <>
            <span className="shrink-0" style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)", display: "inline-block" }} aria-hidden="true" />
            <LiveDetail item={item} />
          </>
        )}
      </span>

      {item.href && (
        <span className="shrink-0" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }} aria-hidden="true">→</span>
      )}

      {/* Date + location */}
      {(item.location || item.endDate) && (
        <span className="hidden md:flex items-center gap-1.5 shrink-0 ml-auto pl-3">
          {item.location && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>{item.location}</span>
          )}
          {item.location && item.date && (
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>·</span>
          )}
          {item.date && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>
              {formatDateRange(item.date, locale, item.endDate)}
            </span>
          )}
        </span>
      )}

    </div>
  );

  return item.href ? (
    <Link href={scopedHref(item.href)} className="block h-full hover:opacity-90 transition-opacity">{inner}</Link>
  ) : inner;
}

// ── Upcoming bar ─────────────────────────────────────────────────────────────

function UpcomingBar({ items, upcoming, locale }: { items: TickerItem[]; upcoming: string; locale: string }) {
  const [paused, setPaused] = useState(false);
  const [touchDx, setTouchDx] = useState(0);
  const [smoothReturn, setSmoothReturn] = useState(false);
  const touchStartX = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubled = [...items, ...items];

  function cancelResume() {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }

  function handleTouchStart(e: React.TouchEvent) {
    cancelResume();
    setSmoothReturn(false);
    setPaused(true);
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    setTouchDx(e.touches[0].clientX - touchStartX.current);
  }

  function handleTouchEnd() {
    resumeTimer.current = setTimeout(() => {
      setSmoothReturn(true);
      setTouchDx(0);
      // resume after transition finishes
      setTimeout(() => {
        setSmoothReturn(false);
        setPaused(false);
      }, 250);
    }, 1000);
  }

  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: 32, background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}
      role="region"
      aria-label="Najava takmičenja"
      onMouseEnter={() => { cancelResume(); setPaused(true); }}
      onMouseLeave={() => { cancelResume(); setPaused(false); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mx-auto max-w-7xl px-4 h-full flex items-center gap-3">

        {/* Static label */}
        <span
          className="shrink-0 font-extrabold uppercase rounded px-1.5"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--muted)", height: 20, display: "inline-flex", alignItems: "center" }}
        >
          {upcoming}
        </span>
        <span className="shrink-0" style={{ width: 1, height: 10, background: "var(--border)", display: "inline-block" }} aria-hidden="true" />

        {/* Marquee track */}
        <div className="flex-1 overflow-hidden min-w-0">
          {/* Touch offset wrapper — shifts content during swipe, smoothly returns on resume */}
          <div style={{
            transform: `translateX(${touchDx}px)`,
            transition: smoothReturn ? "transform 250ms ease-out" : "none",
          }}>
            <div
              className="flex items-center"
              style={{
                animation: `ticker-scroll ${doubled.length * 7}s linear infinite`,
                animationPlayState: paused ? "paused" : "running",
                width: "max-content",
              }}
            >
              {doubled.map((item, i) => (
                <div key={`${item.id}-${i}`} className="flex items-center shrink-0">
                  <span className="px-3 shrink-0" style={{ color: "var(--border)", fontSize: 13, lineHeight: 1, userSelect: "none" }} aria-hidden="true">·</span>
                  <UpcomingItem item={item} locale={locale} />
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function UpcomingItem({ item, locale }: { item: TickerItem; locale: string }) {
  const scopedHref = useScopedHref();
  const d       = new Date(item.date + "T00:00:00");
  const localeStr = locale === "en" ? "en-US" : "sr-Latn-RS";
  const dateStr = d.toLocaleDateString(localeStr, { day: "numeric", month: "short" });

  const content = (
    <span className="flex items-center gap-1.5">
      <span className="font-bold shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 10, color: "var(--muted)" }}>
        {dateStr}
      </span>
      <span className="font-medium whitespace-nowrap" style={{ fontSize: 11, color: "var(--ink)" }}>
        {item.name}
      </span>
    </span>
  );

  if (item.href) {
    return <Link href={scopedHref(item.href)} className="hover:opacity-70 transition-opacity">{content}</Link>;
  }
  return content;
}
