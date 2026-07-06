"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ViewToggle({ activeView }: { activeView: "list" | "cal" }) {
  const sp = useSearchParams();

  const makeUrl = (view: "list" | "cal") => {
    const p = new URLSearchParams(sp.toString());
    if (view === "list") p.delete("view");
    else p.set("view", "cal");
    const str = p.toString();
    return `/takmicenja${str ? `?${str}` : ""}`;
  };

  const base =
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors";
  const on  = "bg-[var(--ink)] text-[var(--bg)]";
  const off = "text-[var(--muted)] hover:text-[var(--ink)]";

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
      <Link href={makeUrl("list")} scroll={false} className={`${base} ${activeView === "list" ? on : off}`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1.5 3h9M1.5 6h9M1.5 9h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Lista
      </Link>
      <Link href={makeUrl("cal")} scroll={false} className={`${base} ${activeView === "cal" ? on : off}`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Kalendar
      </Link>
    </div>
  );
}
