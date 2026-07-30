"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";
import { useTranslations, useLocale } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";

export interface TickerDetailItem { label?: string; text: string; href?: string; status?: "REVIEW"; }

export interface TickerItem {
  id: number;
  name: string;
  date: string;
  endDate?: string;
  location?: string;
  level: string;
  status: "LIVE" | "USKORO" | "NEXT" | "NEUTRAL" | "REVIEW" | "CUSTOM";
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

// Competitions starting this soon get pulled into the live cycle instead of waiting in the marquee.
const IMMINENT_LEAD_DAYS = 2;

function isImminent(dateStr: string): boolean {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= IMMINENT_LEAD_DAYS;
}

export function Ticker({
  liveItems = [],
  upcomingItems = [],
}: {
  liveItems?: TickerItem[];
  upcomingItems?: TickerItem[];
}) {
  const t = useTranslations("common");
  const locale = useLocale();

  // Single strip: while something is live, cycle live + imminent (≤2d) upcoming.
  // Otherwise the whole strip becomes the upcoming marquee.
  const hasLive     = liveItems.length > 0;
  const cycleItems  = hasLive ? [...liveItems, ...upcomingItems.filter((item) => isImminent(item.date))] : [];
  const marqueeItems = hasLive ? [] : upcomingItems;

  if (cycleItems.length === 0 && marqueeItems.length === 0) return null;

  return (
    <div
      className="w-full"
      style={{ borderTop: "2px solid var(--brand-primary)", borderBottom: "1px solid var(--border)" }}
    >
      {cycleItems.length > 0 && <UpperBar items={cycleItems} live={t("live")} upcoming={t("upcoming")} nextLabel={t("next")} review={t("results")} locale={locale} />}
      {marqueeItems.length > 0 && <UpcomingBar items={marqueeItems} upcoming={t("upcoming")} locale={locale} />}
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

function LiveDetail({ item, onStatusChange }: { item: TickerItem; onStatusChange?: (status?: TickerDetailItem["status"]) => void }) {
  const scopedHref = useScopedHref();
  const items = useMemo<TickerDetailItem[]>(() => item.detailItems?.length
    ? item.detailItems
    : item.detailText ? [{ text: item.detailText }] : [], [item.detailItems, item.detailText]);

  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);
  const current = items.length ? items[idx % items.length] : undefined;

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx((i) => (i + 1) % items.length); setVisible(true); }, 350);
    }, 4000);
    return () => clearInterval(interval);
  }, [items.length]);

  useEffect(() => {
    onStatusChange?.(current?.status);
  }, [current, onStatusChange]);

  if (!current) return null;

  const detail = (
    <span
      className="shrink-0 flex items-center gap-1.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease", minWidth: 80 }}
    >
      {current.label && (
        <span className="font-extrabold uppercase" style={{ fontSize: 9, lineHeight: 1, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)" }}>
          {current.label}
        </span>
      )}
      <span className="font-bold" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11, lineHeight: 1, color: "rgba(255,255,255,0.9)" }}>
        {current.text}
      </span>
    </span>
  );
  return current.href ? <Link href={scopedHref(current.href)} className="hover:opacity-75 transition-opacity">{detail}</Link> : detail;
}

// ── Upper bar (cycles through live + uskoro + custom) ────────────────────────

function UpperBar({ items, live, upcoming, nextLabel, review, locale }: { items: TickerItem[]; live: string; upcoming: string; nextLabel: string; review: string; locale: string }) {
  return (
    <>
      <div className="sm:hidden"><MobileUpperBar items={items} live={live} upcoming={upcoming} nextLabel={nextLabel} review={review} /></div>
      <div className="hidden sm:block"><DesktopUpperBar items={items} live={live} upcoming={upcoming} nextLabel={nextLabel} review={review} locale={locale} /></div>
    </>
  );
}

type MobileTickerSegment = {
  item: TickerItem;
  text: string;
  href?: string;
};

function MobileUpperBar({ items, live, upcoming, nextLabel, review }: { items: TickerItem[]; live: string; upcoming: string; nextLabel: string; review: string }) {
  const scopedHref = useScopedHref();
  const segments = useMemo<MobileTickerSegment[]>(() => items.flatMap((item) => {
    const details = item.status !== "USKORO" || item.detailItems?.length
      ? item.detailItems?.length ? item.detailItems : item.detailText ? [{ text: item.detailText }] : []
      : [];

    return [
      { item, text: item.name, href: item.href },
      ...details.map((detail) => ({
        item: { ...item, status: detail.status ?? item.status },
        text: detail.label ? `${detail.label} · ${detail.text}` : detail.text,
        href: detail.href,
      })),
    ];
  }), [items]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [badgeVisible, setBadgeVisible] = useState(true);
  const [travelPx, setTravelPx] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const segment = segments[Math.min(idx, segments.length - 1)];
  const travelDuration = Math.max(2200, Math.ceil(travelPx / 0.02));
  const segmentDuration = travelPx > 0 ? travelDuration * 2 + 1200 : 4000;

  const badgeKeyFor = (s: MobileTickerSegment) =>
    s.item.status === "CUSTOM" ? s.item.label ?? null : s.item.status;

  useEffect(() => {
    const measure = () => setTravelPx(Math.max(0, (textRef.current?.scrollWidth ?? 0) - (viewportRef.current?.clientWidth ?? 0)));
    measure();
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [idx]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextIdx = (idx + 1) % segments.length;
      const badgeChanges = badgeKeyFor(segments[idx]) !== badgeKeyFor(segments[nextIdx]);
      setVisible(false);
      if (badgeChanges) setBadgeVisible(false);
      setTimeout(() => {
        setIdx(nextIdx);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setVisible(true);
          setBadgeVisible(true);
        }));
      }, 220);
    }, segmentDuration);
    return () => clearTimeout(timer);
  }, [idx, segmentDuration, segments]);

  const isLive = segment.item.status === "LIVE";
  const isUpcoming = segment.item.status === "USKORO";
  const isNext = segment.item.status === "NEXT";
  const isReview = segment.item.status === "REVIEW";
  const scrollStyle = travelPx > 0
    ? {
        "--ticker-mobile-distance": `-${travelPx}px`,
        animation: `ticker-mobile-scroll ${segmentDuration}ms ease-in-out both`,
      } as CSSProperties
    : undefined;
  const text = (
    <span
      ref={textRef}
      key={`${segment.item.id}-${idx}`}
      className="inline-block whitespace-nowrap font-semibold text-xs leading-none"
      style={{ color: "white", ...scrollStyle }}
    >
      {segment.text}
    </span>
  );

  return (
    <div className="h-8 overflow-hidden" style={{ background: "var(--brand-primary)" }} role="status" aria-label={`Ticker: ${segment.text}`}>
      <div className="mx-auto flex h-full max-w-7xl items-center gap-2 pl-2 pr-4">
        <div className="flex items-center gap-2 shrink-0" style={{ opacity: badgeVisible ? 1 : 0, transition: "opacity 0.22s ease" }}>
          {isLive && <MobileStatusBadge label={live} live />}
          {isUpcoming && <MobileStatusBadge label={upcoming.toUpperCase()} />}
          {isNext && <MobileStatusBadge label={nextLabel.toUpperCase()} neutral />}
          {isReview && <MobileStatusBadge label={review.toUpperCase()} review />}
          {segment.item.status === "CUSTOM" && segment.item.label && <MobileStatusBadge label={segment.item.label} />}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2" style={{ opacity: visible ? 1 : 0, transition: "opacity 0.22s ease" }}>
          <span className="shrink-0" style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)" }} aria-hidden="true" />
          <div ref={viewportRef} className="min-w-0 flex-1 overflow-hidden flex items-center h-full">
            {segment.href ? <Link href={scopedHref(segment.href)} className="block hover:opacity-80 leading-none">{text}</Link> : text}
          </div>
          {segment.href && <span className="shrink-0" style={{ fontSize: 11, lineHeight: 1, color: "rgba(255,255,255,0.45)" }} aria-hidden="true">→</span>}
        </div>
      </div>
    </div>
  );
}

function MobileStatusBadge({ label, live = false, neutral = false, review = false }: { label: string; live?: boolean; neutral?: boolean; review?: boolean }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded px-1.5 font-extrabold select-none leading-none" style={{ fontSize: 11, letterSpacing: "0.08em", color: live ? "var(--brand-primary)" : review ? "var(--brand-accent)" : neutral ? "rgba(255,255,255,0.85)" : "#92400e", background: live || review ? "white" : neutral ? "rgba(255,255,255,0.14)" : "#fefce8" }}>
      {live && <span className="shrink-0 rounded-full" style={{ width: 5, height: 5, background: "var(--brand-primary)", animation: "ticker-pulse 1.4s ease-in-out infinite" }} />}
      {label}
    </span>
  );
}

function DesktopUpperBar({ items, live, upcoming, nextLabel, review, locale }: { items: TickerItem[]; live: string; upcoming: string; nextLabel: string; review: string; locale: string }) {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx((i) => (i + 1) % items.length); setVisible(true); }, 320);
    }, 6000);
    return () => clearInterval(interval);
  }, [items.length]);

  const item = items[Math.min(idx, items.length - 1)];

  return (
    <div style={{ height: 32, background: "var(--brand-primary)", overflow: "hidden" }} role="status" aria-label={`Ticker: ${item.name}`}>
      <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.32s ease", height: 32 }}>
        <LiveBarInner item={item} live={live} upcoming={upcoming} nextLabel={nextLabel} review={review} locale={locale} />
      </div>
    </div>
  );
}

function LiveBarInner({ item, live, upcoming, nextLabel, review, locale }: { item: TickerItem; live: string; upcoming: string; nextLabel: string; review: string; locale: string }) {
  const scopedHref = useScopedHref();
  const [detailStatus, setDetailStatus] = useState<TickerDetailItem["status"]>();
  const status = detailStatus ?? item.status;
  const isLive   = status === "LIVE";
  const isUskoro = status === "USKORO";
  const isNext = status === "NEXT";
  const isReview = status === "REVIEW";

  const inner = (
    <div className="mx-auto max-w-7xl pl-2 pr-4 h-full flex items-center gap-3 min-w-0">

      {/* Status badge */}
      {isLive && (
        <span
          className="inline-flex items-center gap-1.5 shrink-0 font-extrabold select-none rounded px-1.5 leading-none"
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
          className="inline-flex items-center gap-1.5 shrink-0 font-extrabold select-none rounded px-1.5 leading-none"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "#92400e", background: "#fefce8", height: 20 }}
        >
          <span
            className="rounded-full shrink-0"
            style={{ width: 5, height: 5, background: "#f59e0b", display: "inline-block", animation: "ticker-pulse 2s ease-in-out infinite" }}
          />
          {upcoming.toUpperCase()}
        </span>
      )}

      {isReview && (
        <span className="inline-flex items-center shrink-0 font-extrabold select-none rounded px-1.5 leading-none" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--brand-accent)", background: "white", height: 20 }}>
          {review.toUpperCase()}
        </span>
      )}

      {isNext && (
        <span className="inline-flex items-center shrink-0 font-extrabold select-none rounded px-1.5 leading-none" style={{ fontSize: 11, letterSpacing: "0.08em", color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.14)", height: 20 }}>
          {nextLabel.toUpperCase()}
        </span>
      )}

      {item.status === "CUSTOM" && item.label && (
        <span
          className="inline-flex items-center shrink-0 font-extrabold select-none rounded px-1.5 leading-none"
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
          <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded px-1.5 leading-none" style={{ background: "white", height: 20 }}>
            <span className="inline-flex items-center rounded font-extrabold uppercase px-1 h-full leading-none" style={{ fontSize: 11, letterSpacing: "0.06em", background: s.background, color: s.color }}>
              {LEVEL_LABEL[item.level] ?? item.level}
            </span>
            {item.countryCode2 && (
              <>
                <span style={{ color: "rgba(0,0,0,0.2)", fontSize: 9, lineHeight: 1 }}>·</span>
                <span className={`fi fi-${item.countryCode2.toLowerCase()}`} style={{ fontSize: 11, borderRadius: 2 }} />
                {item.nocCode && (
                  <span className="font-bold" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11, lineHeight: 1, fontWeight: 800, color: "var(--ink)", letterSpacing: "0.06em" }}>
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
        <span className="font-semibold text-xs leading-none truncate min-w-0" style={{ color: "white" }}>
          {item.name}
        </span>

        {(item.detailItems?.length || item.detailText) && (
          <>
            <span className="shrink-0" style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)", display: "inline-block" }} aria-hidden="true" />
            <LiveDetail item={item} onStatusChange={setDetailStatus} />
          </>
        )}
      </span>

      {item.href && (
        <span className="shrink-0" style={{ fontSize: 11, lineHeight: 1, color: "rgba(255,255,255,0.45)" }} aria-hidden="true">→</span>
      )}

      {/* Date + location */}
      {(item.location || item.endDate) && (
        <span className="hidden md:flex items-center gap-1.5 shrink-0 ml-auto pl-3">
          {item.location && (
            <span style={{ fontSize: 11, lineHeight: 1, color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>{item.location}</span>
          )}
          {item.location && item.date && (
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 1 }}>·</span>
          )}
          {item.date && (
            <span style={{ fontSize: 11, lineHeight: 1, color: "rgba(255,255,255,0.95)", fontWeight: 600 }}>
              {formatDateRange(item.date, locale, item.endDate)}
            </span>
          )}
        </span>
      )}

    </div>
  );

  const hasLinkedDetail = item.detailItems?.some((detail) => detail.href);
  return item.href && !hasLinkedDetail ? (
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
  const trackRef = useRef<HTMLDivElement>(null);
  const singleViewportRef = useRef<HTMLDivElement>(null);
  const singleItemRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [singleTravelPx, setSingleTravelPx] = useState(0);
  const doubled = [...items, ...items];

  useEffect(() => {
    const measure = () => setTrackWidth(trackRef.current?.scrollWidth ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    if (trackRef.current) observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (items.length !== 1) return;
    const measure = () => setSingleTravelPx(Math.max(0, (singleItemRef.current?.scrollWidth ?? 0) - (singleViewportRef.current?.clientWidth ?? 0)));
    measure();
    const observer = new ResizeObserver(measure);
    if (singleViewportRef.current) observer.observe(singleViewportRef.current);
    return () => observer.disconnect();
  }, [items]);

  // Constant reading speed (~15px/s) so long text isn't rushed just because there's more of it.
  const duration = trackWidth > 0 ? Math.max(8, trackWidth / 2 / 15) : doubled.length * 7;
  const singleDuration = Math.max(4_000, Math.ceil(singleTravelPx / 0.015) * 2 + 1_200);

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
      style={{ height: 32, background: "var(--brand-primary)" }}
      role="region"
      aria-label="Najava takmičenja"
      onMouseEnter={() => { cancelResume(); setPaused(true); }}
      onMouseLeave={() => { cancelResume(); setPaused(false); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-4 h-full flex items-center gap-3">

        {/* Static label */}
        <span
          className="inline-flex items-center gap-1.5 shrink-0 font-extrabold select-none rounded px-1.5 leading-none"
          style={{ fontSize: 11, letterSpacing: "0.08em", color: "#92400e", background: "#fefce8", height: 20 }}
        >
          <span
            className="rounded-full shrink-0"
            style={{ width: 5, height: 5, background: "#f59e0b", display: "inline-block", animation: "ticker-pulse 2s ease-in-out infinite" }}
          />
          {upcoming.toUpperCase()}
        </span>
        <span className="hidden shrink-0 sm:block" style={{ width: 1, height: 12, background: "rgba(255,255,255,0.25)" }} aria-hidden="true" />

        {/* One announcement stays still; only its overflow gets a slow return scroll. */}
        <div className="flex-1 overflow-hidden min-w-0">
          {items.length === 1 ? (
            <div
              ref={singleViewportRef}
              className="relative overflow-hidden"
            >
              <div
                ref={singleItemRef}
                className="w-max"
                style={singleTravelPx > 0 ? {
                  "--ticker-mobile-distance": `-${singleTravelPx}px`,
                  animation: `ticker-mobile-scroll ${singleDuration}ms ease-in-out infinite`,
                  animationPlayState: paused ? "paused" : "running",
                } as CSSProperties : undefined}
              >
                <UpcomingItem item={items[0]} locale={locale} />
              </div>
              {singleTravelPx > 0 && <>
                <span className="pointer-events-none absolute inset-y-0 left-0 w-4" style={{ background: "linear-gradient(to right, var(--brand-primary), transparent)" }} aria-hidden="true" />
                <span className="pointer-events-none absolute inset-y-0 right-0 w-5" style={{ background: "linear-gradient(to left, var(--brand-primary), transparent)" }} aria-hidden="true" />
              </>}
            </div>
          ) : (
            <div style={{
              transform: `translateX(${touchDx}px)`,
              transition: smoothReturn ? "transform 250ms ease-out" : "none",
            }}>
              <div
                ref={trackRef}
                className="flex items-center"
              style={{
                animationName: "ticker-scroll",
                animationDuration: `${duration}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationPlayState: paused ? "paused" : "running",
                width: "max-content",
              }}
            >
              {doubled.map((item, i) => (
                <div key={`${item.id}-${i}`} className="flex items-center shrink-0">
                  <span className="px-3 shrink-0" style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, lineHeight: 1, userSelect: "none" }} aria-hidden="true">·</span>
                  <UpcomingItem item={item} locale={locale} />
                </div>
              ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function UpcomingItem({ item, locale }: { item: TickerItem; locale: string }) {
  const scopedHref = useScopedHref();
  const dateStr = formatDateRange(item.date, locale, item.endDate);

  const content = (
    <span className="flex items-center gap-1.5">
      <span className="font-bold shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 10, lineHeight: 1, color: "rgba(255,255,255,0.7)" }}>
        {dateStr}
      </span>
      <span className="font-medium whitespace-nowrap" style={{ fontSize: 11, lineHeight: 1, color: "white" }}>
        {item.name}
      </span>
    </span>
  );

  if (item.href) {
    return <Link href={scopedHref(item.href)} className="hover:opacity-70 transition-opacity">{content}</Link>;
  }
  return content;
}
