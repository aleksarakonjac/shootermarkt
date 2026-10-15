"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const COMPACT_AFTER = 24;

/**
 * Sticky header javnog sajta. Na mobilnom se pri skrolovanju nadole sužava
 * (data-compact → potomci koriste group-data-[compact=true]:…), a stvarnu visinu
 * (uključujući live traku) objavljuje kao --site-header-h za fiksne/sticky elemente.
 */
export function SiteHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCompact(window.scrollY > COMPACT_AFTER));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
  }, []);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const publish = () => document.documentElement.style.setProperty("--site-header-h", `${header.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      data-compact={compact}
      className="group sticky top-0 z-[var(--z-sticky)] bg-[var(--bg)] border-b border-[var(--border)]"
    >
      {children}
    </header>
  );
}
