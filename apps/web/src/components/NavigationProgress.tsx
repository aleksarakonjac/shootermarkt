"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { routing } from "@/i18n/routing";
import { useUiLocale } from "@/hooks/use-ui-locale";

/**
 * Tanka traka napretka na vrhu ekrana dok se učitava sledeća stranica.
 *
 * App Router nema router evente, pa: start = klik na interni link (capture faza,
 * pre nego što Next Link preuzme klik), back/forward ili ručni poziv
 * `startNavigationProgress()` pre `router.push`; kraj = promena pathname/searchParams.
 * Prikazuje se tek posle SHOW_DELAY ms, pa brze navigacije ne trepću.
 */

const SHOW_DELAY = 150;
const SAFETY_TIMEOUT = 15_000;
const TRICKLE_INTERVAL = 200;
const FADE_OUT = 400;

type BarState = { phase: "idle" | "loading" | "done"; progress: number };

let state: BarState = { phase: "idle", progress: 0 };
let pending = false;
let showTimer: number | null = null;
let safetyTimer: number | null = null;
let trickleTimer: number | null = null;
let fadeTimer: number | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getState = () => state;
const IDLE: BarState = { phase: "idle", progress: 0 };
const getServerState = () => IDLE;

function setState(next: BarState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function clearTimer(id: number | null) {
  if (id != null) window.clearTimeout(id);
  return null;
}

function stopTrickle() {
  if (trickleTimer != null) window.clearInterval(trickleTimer);
  trickleTimer = null;
}

function begin() {
  if (pending) return;
  pending = true;
  fadeTimer = clearTimer(fadeTimer);
  showTimer = clearTimer(showTimer);
  safetyTimer = clearTimer(safetyTimer);
  showTimer = window.setTimeout(() => {
    setState({ phase: "loading", progress: 0.08 });
    stopTrickle();
    // Približava se 90% sve sporije dok čekamo server.
    trickleTimer = window.setInterval(() => {
      setState({ phase: "loading", progress: state.progress + (0.9 - state.progress) * 0.08 });
    }, TRICKLE_INTERVAL);
  }, SHOW_DELAY);
  safetyTimer = window.setTimeout(finish, SAFETY_TIMEOUT);
}

function finish() {
  if (!pending) return;
  pending = false;
  showTimer = clearTimer(showTimer);
  safetyTimer = clearTimer(safetyTimer);
  stopTrickle();
  if (state.phase !== "loading") return;
  setState({ phase: "done", progress: 1 });
  fadeTimer = window.setTimeout(() => setState(IDLE), FADE_OUT);
}

// next-intl router prima putanje bez locale prefiksa (/srb/...), a window.location ga ima (/sr/srb/...).
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
const stripLocale = (pathname: string) => pathname.replace(LOCALE_PREFIX, "") || "/";

function isSameDestination(url: URL) {
  return stripLocale(url.pathname) === stripLocale(window.location.pathname) && url.search === window.location.search;
}

/** Pozovi pre `router.push/replace`. Ako je odredište ista stranica (npr. samo hash), ne radi ništa. */
export function startNavigationProgress(href?: string) {
  if (typeof window === "undefined") return;
  if (href) {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || isSameDestination(url)) return;
  }
  begin();
}

function isTrackedClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || !anchor.href || anchor.hasAttribute("download")) return false;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;
  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin && !isSameDestination(url);
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { phase, progress } = useSyncExternalStore(subscribe, getState, getServerState);
  const en = useUiLocale() === "en";

  // Start: klikovi na interne linkove i back/forward.
  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (isTrackedClick(event)) begin(); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", begin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", begin);
    };
  }, []);

  // Kraj: nova ruta je renderovana.
  useEffect(() => { finish(); }, [pathname, searchParams]);

  if (phase === "idle") return null;

  return (
    <div
      role="progressbar"
      aria-label={en ? "Loading page" : "Učitavanje stranice"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-tooltip)] h-[3px]"
      style={{ opacity: phase === "done" ? 0 : 1, transition: "opacity 300ms ease 100ms" }}
    >
      <div
        className="h-full bg-[var(--brand-primary)] motion-reduce:transition-none"
        style={{ width: `${progress * 100}%`, transition: "width 200ms ease-out", boxShadow: "0 0 8px var(--brand-primary)" }}
      />
    </div>
  );
}
