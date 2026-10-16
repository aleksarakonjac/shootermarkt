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
const SETTLE_MS = 200;
const RING = 2 * Math.PI * 9;
export const PULL_CONTENT_ID = "page-content";

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

  // Stranica (a ne indikator) prati prst. Transform stoji samo dok traje gest/osvežavanje,
  // da ne utiče na fixed elemente u mirovanju.
  useEffect(() => {
    const content = document.getElementById(PULL_CONTENT_ID);
    if (!content) return;
    if (pull > 0 || refreshing) {
      content.style.transition = dragging ? "none" : `transform ${SETTLE_MS}ms ease`;
      content.style.transform = `translateY(${pull}px)`;
      return;
    }
    content.style.transition = `transform ${SETTLE_MS}ms ease`;
    content.style.transform = "translateY(0)";
    const timeout = window.setTimeout(() => { content.style.transform = ""; content.style.transition = ""; }, SETTLE_MS);
    return () => window.clearTimeout(timeout);
  }, [pull, dragging, refreshing]);

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

  const active = pull > 0 || refreshing;
  const ready = pull >= PULL_THRESHOLD;
  const progress = Math.min(1, pull / PULL_THRESHOLD);

  // Cela stranica klizi nadole i otkriva prazan prostor; indikator živi u tom prostoru.
  return (
    <div
      role={active ? "status" : undefined}
      aria-label={active
        ? (en
          ? (refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh")
          : (refreshing ? "Osvežavanje" : ready ? "Pusti za osvežavanje" : "Povuci za osvežavanje"))
        : undefined}
      aria-hidden={active ? undefined : true}
      className="pointer-events-none fixed inset-x-0 top-0 flex items-center justify-center overflow-hidden bg-[var(--bg)]"
      style={{ height: pull, transition: dragging ? "none" : `height ${SETTLE_MS}ms ease` }}
    >
      <svg
        width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined}
        style={{
          opacity: refreshing ? 1 : progress,
          transform: refreshing ? undefined : `scale(${0.5 + 0.5 * progress}) rotate(${progress * 270}deg)`,
          transition: dragging ? "none" : `opacity ${SETTLE_MS}ms ease`,
        }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="var(--border)" />
        <circle
          cx="12" cy="12" r="9" stroke="var(--brand-primary)"
          strokeDasharray={RING}
          strokeDashoffset={RING * (refreshing ? 0.7 : 1 - progress)}
          transform="rotate(-90 12 12)"
        />
      </svg>
    </div>
  );
}
