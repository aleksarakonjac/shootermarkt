"use client";

import { useEffect, useRef, useState } from "react";
import { useUiLocale } from "@/hooks/use-ui-locale";

/**
 * Povuci nadole na vrhu stranice → osveži stranicu i podatke.
 *
 * Radi SAMO kad je sajt otvoren kao instalirana aplikacija (display-mode: standalone,
 * iOS navigator.standalone) — tada pregledač nema svoj pull-to-refresh. U običnom
 * pregledaču ostaje ugrađeni gest, da se dva ne bi sudarala.
 */

export const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

/** Otpor: prst prelazi više nego indikator (kao nativni gest). */
export function pullDistance(dy: number) {
  return Math.min(MAX_PULL, Math.max(0, dy) * 0.5);
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Dodir unutar elementa koji je sam skrolovan (lista, meni) ne sme da pokrene osvežavanje. */
function insideScrolledElement(target: EventTarget | null) {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

const reloadPage = () => window.location.reload();

export function PullToRefresh({ onRefresh = reloadPage }: { onRefresh?: () => void }) {
  const en = useUiLocale() === "en";
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pullRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!isStandalone()) return;
    // Bez gumenog odskoka pregledača, da gest kontroliše samo ova komponenta.
    document.documentElement.style.overscrollBehaviorY = "contain";

    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && e.touches.length === 1 && !insideScrolledElement(e.target)
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : null;
    };
    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dx = e.touches[0].clientX - start.current.x;
      const dy = e.touches[0].clientY - start.current.y;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
        if (pullRef.current) { pullRef.current = 0; setPull(0); }
        return;
      }
      if (e.cancelable) e.preventDefault();
      pullRef.current = pullDistance(dy);
      setDragging(true);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (!start.current) return;
      start.current = null;
      setDragging(false);
      if (pullRef.current >= PULL_THRESHOLD) {
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        onRefreshRef.current();
      } else {
        setPull(0);
      }
      pullRef.current = 0;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      document.documentElement.style.overscrollBehaviorY = "";
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (pull === 0 && !refreshing) return null;
  const ready = pull >= PULL_THRESHOLD;

  return (
    <div
      role="status"
      aria-label={en
        ? (refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh")
        : (refreshing ? "Osvežavanje" : ready ? "Pusti za osvežavanje" : "Povuci za osvežavanje")}
      className="pointer-events-none fixed left-1/2 z-[var(--z-tooltip)] flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] shadow-md"
      style={{ top: `calc(var(--site-header-h, 3.5rem) + ${pull - 28}px)`, opacity: Math.min(1, pull / PULL_THRESHOLD), transition: dragging ? "none" : "top 200ms ease, opacity 200ms ease" }}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined}
        style={refreshing ? undefined : { transform: `rotate(${(pull / PULL_THRESHOLD) * 270}deg)` }}
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </svg>
    </div>
  );
}
