"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ScopedLink } from "../../components/ScopedLink";

interface Props {
  activeWhen: "upcoming" | "past";
  upcomingHref: string;
  pastHref: string;
  upcomingCount: number;
  pastCount: number;
  locale: string;
}

export function WhenTabs({ activeWhen, upcomingHref, pastHref, upcomingCount, pastCount, locale }: Props) {
  const t = useTranslations("competition");
  const [visual, setVisual] = useState(activeWhen);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisual(activeWhen); }, [activeWhen]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector("[aria-selected='true']") as HTMLElement | null;
    if (!active) return;
    const cr = container.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    setIndicator({ left: ar.left - cr.left, width: ar.width });
    setReady(true);
  }, [visual]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, key: "upcoming" | "past") {
    setVisual(key);
    const el = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const ar = el.getBoundingClientRect();
    setIndicator({ left: ar.left - cr.left, width: ar.width });
  }

  const tabs = [
    { key: "upcoming" as const, label: t("list.upcoming"), count: upcomingCount, href: upcomingHref },
    { key: "past" as const,     label: t("list.past"),     count: pastCount,     href: pastHref     },
  ];

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={locale === "en" ? "Time period" : "Vremenski period"}
      className="relative flex border-b border-[var(--border)] mb-6 -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      {/* Sliding indicator */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-0 h-0.5 bg-[var(--ink)] ${ready ? "transition-[left,width] duration-200 ease-out" : ""}`}
        style={{ left: indicator.left, width: indicator.width }}
      />

      {tabs.map(({ key, label, count, href }) => (
        <ScopedLink
          key={key}
          href={href}
          role="tab"
          aria-selected={visual === key}
          scroll={false}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            visual === key
              ? "text-[var(--ink)]"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
          onClick={(e) => handleClick(e, key)}
        >
          {label}
          <span className={`text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] tabular-nums transition-colors ${
            visual === key ? "text-[var(--muted)]" : "text-[var(--subtle)]"
          }`}>
            {count}
          </span>
        </ScopedLink>
      ))}
    </div>
  );
}
