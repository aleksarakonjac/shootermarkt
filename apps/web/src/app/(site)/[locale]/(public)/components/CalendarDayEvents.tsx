"use client";

import { Link } from "@/i18n/navigation";
import { getLevelLabel, LEVEL_STYLE } from "@/lib/competition-utils";
import { useScopedHref } from "@/hooks/use-scoped-href";
import { formatShortDateRange } from "@/lib/date-utils";

export interface DayEvent {
  id: number;
  name: string;
  location: string | null;
  level: string;
  date: string;
  endDate: string | null;
  countryName?: string | null;
  countryCode2?: string | null;
}

// Sadržaj tamnog prozora za dan u kalendaru (početna + takmičenja): nivo, naziv, trajanje, mesto i zemlja; klik vodi na takmičenje.
export function CalendarDayEvents({ comps, locale }: { comps: DayEvent[]; locale: string }) {
  const scopedHref = useScopedHref();
  return comps.map((c) => {
    const levelStyle = LEVEL_STYLE[c.level.toLowerCase()] ?? LEVEL_STYLE.club;
    return <Link key={c.id} href={scopedHref(`/takmicenja/${c.id}`)} className="flex flex-col gap-1 py-1 border-b border-white/10 last:border-0 hover:text-white/80">
      <span className="self-start rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={levelStyle}>
        {getLevelLabel(c.level.toLowerCase(), locale)}
      </span>
      <span className="font-semibold leading-tight">{c.name}</span>
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] tabular-nums text-white/80">{formatShortDateRange(c.date, c.endDate, locale)}</span>
      {(c.location || c.countryName) && (
        <span className="flex items-center gap-1.5 text-white/80">
          {c.countryCode2 && (
            <span className={`fi fi-${c.countryCode2.toLowerCase()} shrink-0`} style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block" }} />
          )}
          <span>{[c.location, c.countryName].filter(Boolean).join(" · ")}</span>
        </span>
      )}
    </Link>;
  });
}
