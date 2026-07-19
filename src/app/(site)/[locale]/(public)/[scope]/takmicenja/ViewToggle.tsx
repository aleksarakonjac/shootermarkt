"use client";

import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { useState, useEffect } from "react";

export function ViewToggle({ activeView }: { activeView: "list" | "cal" }) {
  const sp = useSearchParams();
  const t = useTranslations("competition.list");
  const scopedHref = useScopedHref();
  const [visual, setVisual] = useState(activeView);

  useEffect(() => { setVisual(activeView); }, [activeView]);

  const makeUrl = (view: "list" | "cal") => {
    const p = new URLSearchParams(sp.toString());
    if (view === "list") p.delete("view");
    else p.set("view", "cal");
    const str = p.toString();
    return `/takmicenja${str ? `?${str}` : ""}`;
  };

  const btnBase = "relative z-10 flex flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150";

  return (
    <div className="relative flex items-center p-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
      {/* Sliding pill */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-md bg-[var(--ink)] transition-transform duration-200 ease-out"
        style={{
          width: "calc(50% - 0.25rem)",
          transform: visual === "cal" ? "translateX(calc(100% + 0.25rem))" : "translateX(0)",
        }}
      />
      <Link
        href={scopedHref(makeUrl("list"))}
        scroll={false}
        className={`${btnBase} ${visual === "list" ? "text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
        onClick={() => setVisual("list")}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1.5 3h9M1.5 6h9M1.5 9h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {t("viewList")}
      </Link>
      <Link
        href={scopedHref(makeUrl("cal"))}
        scroll={false}
        className={`${btnBase} ${visual === "cal" ? "text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
        onClick={() => setVisual("cal")}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {t("viewCalendar")}
      </Link>
    </div>
  );
}
