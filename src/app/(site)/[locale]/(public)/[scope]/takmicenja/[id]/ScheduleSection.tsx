"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { getTickerSlotEnd } from "@/lib/ticker-schedule";

export type ScheduleSlot = {
  id: number;
  disciplineCode: string;
  stage: string;
  category: string;
  startTime: string; // ISO string (UTC)
  endTime: string | null;
};

type Props = {
  slots: ScheduleSlot[];
  locale: string;
  timezone: string; // IANA timezone of the venue, e.g. "Asia/Shanghai"
};

const STAGE_LABELS: Record<string, Record<string, string>> = {
  sr: {
    qual: "Kvalifikacije",
    qual_rapid: "Brza proba",
    qual_precision: "Precizna proba",
    elimination: "Eliminacije",
    final: "Finale",
  },
  en: {
    qual: "Qualification",
    qual_rapid: "Rapid",
    qual_precision: "Precision",
    elimination: "Elimination",
    final: "Final",
  },
};

const CATEGORY_SHORT: Record<string, Record<string, string>> = {
  sr: { junior: "Jun.", youth: "Om.", cadet: "Kad." },
  en: { junior: "Jun.", youth: "Yth.", cadet: "Cad." },
};

const DISCIPLINE_NAMES: Record<string, { sr: string; en: string }> = {
  ARM:  { sr: "Vazdušna puška M",  en: "Air rifle M" },
  ARW:  { sr: "Vazdušna puška Ž",  en: "Air rifle W" },
  APM:  { sr: "Vazdušni pištolj M", en: "Air pistol M" },
  APW:  { sr: "Vazdušni pištolj Ž", en: "Air pistol W" },
  R3PM: { sr: "3×20 puška M",       en: "3×20 rifle M" },
  R3PW: { sr: "3×20 puška Ž",       en: "3×20 rifle W" },
  APMT: { sr: "10m pištolj miks",   en: "10m pistol mixed" },
  ARMT: { sr: "10m puška miks",     en: "10m rifle mixed" },
  SPW:  { sr: "Sport pištolj Ž",    en: "Sport pistol W" },
};

function fmtCountdown(ms: number, locale: string): string {
  if (ms <= 0) return "";
  const totalMins = Math.floor(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const min = totalMins % 60;
  const d = Math.floor(h / 24);
  const hRem = h % 24;
  const pre = locale === "sr" ? "za " : "in ";
  if (d > 0) return hRem > 0 ? `${pre}${d}d ${hRem}h` : `${pre}${d}d`;
  if (h > 0) return min > 0 ? `${pre}${h}h ${min}min` : `${pre}${h}h`;
  return `${pre}${totalMins}min`;
}

function slotStatus(slot: ScheduleSlot, now: Date): "active" | "imminent" | "upcoming" | "past" | "future" {
  const start = new Date(slot.startTime);
  if (start > now) {
    const diff = start.getTime() - now.getTime();
    if (diff < 60 * 60 * 1000) return "imminent";
    if (diff < 2 * 60 * 60 * 1000) return "upcoming";
    return "future";
  }
  const end = getTickerSlotEnd({
    discCode: slot.disciplineCode,
    stage: slot.stage,
    startTime: start,
    endTime: slot.endTime ? new Date(slot.endTime) : null,
  });
  if (end == null) return "past"; // unknown discipline/stage, no endTime → treat as past
  return end >= now ? "active" : "past";
}

function fmtTime(iso: string, timezone?: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function tzDiff(iso: string, venueTimezone: string): string {
  const d = new Date(iso);
  const browserOffset = -d.getTimezoneOffset(); // minutes east of UTC
  const venueFmt = new Intl.DateTimeFormat("en", {
    timeZone: venueTimezone,
    timeZoneName: "shortOffset",
  }).formatToParts(d);
  const offsetStr = venueFmt.find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return "";
  const sign = m[1] === "+" ? 1 : -1;
  const venueOffset = sign * (parseInt(m[2]) * 60 + parseInt(m[3] ?? "0"));
  const diffMin = venueOffset - browserOffset;
  if (diffMin === 0) return "";
  const h = Math.floor(Math.abs(diffMin) / 60);
  const min = Math.abs(diffMin) % 60;
  const prefix = diffMin > 0 ? "+" : "−";
  return min === 0 ? `${prefix}${h}h` : `${prefix}${h}h${min}m`;
}

/** Returns true when venue timezone differs from browser timezone at the given moment. */
function venueDiffersFromBrowser(iso: string, venueTimezone: string): boolean {
  const d = new Date(iso);
  const browserOffset = -d.getTimezoneOffset(); // minutes east of UTC
  const venueFmt = new Intl.DateTimeFormat("en", {
    timeZone: venueTimezone,
    timeZoneName: "shortOffset",
  }).formatToParts(d);
  const offsetStr = venueFmt.find((p) => p.type === "timeZoneName")?.value ?? ""; // "GMT+8"
  const m = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return false;
  const sign = m[1] === "+" ? 1 : -1;
  const venueOffset = sign * (parseInt(m[2]) * 60 + parseInt(m[3] ?? "0"));
  return browserOffset !== venueOffset;
}

function localDateKey(iso: string, timezone?: string): string {
  if (timezone) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date(iso)); // "YYYY-MM-DD"
  }
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtPillDate(key: string, locale: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale === "sr" ? "sr-Latn-RS" : "en-GB", {
    weekday: "short",
    day: "numeric",
  });
}

function todayKey(): string {
  return localDateKey(new Date().toISOString());
}

function pickDefaultDay(dateKeys: string[], byDate: Map<string, ScheduleSlot[]>, now: Date): string {
  // Prefer first day with active or upcoming slot
  for (const dk of dateKeys) {
    if (byDate.get(dk)!.some((s) => {
      const st = slotStatus(s, now);
      return st === "active" || st === "imminent" || st === "upcoming";
    })) return dk;
  }
  // Else today if it's in the list
  const today = todayKey();
  if (dateKeys.includes(today)) return today;
  // Else first future day
  for (const dk of dateKeys) {
    if (dk >= today) return dk;
  }
  // Else last day (all past)
  return dateKeys[dateKeys.length - 1];
}

export function ScheduleSection({ slots, locale, timezone }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (slots.length === 0) return null;

  // Group by venue date
  const dateKeys: string[] = [];
  const byDate = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const key = localDateKey(slot.startTime, timezone);
    if (!byDate.has(key)) {
      dateKeys.push(key);
      byDate.set(key, []);
    }
    byDate.get(key)!.push(slot);
  }

  // Detect if venue TZ differs from browser (computed once per first slot)
  const showDualTime = slots.length > 0 && venueDiffersFromBrowser(slots[0].startTime, timezone);

  const usePills = dateKeys.length >= 3;

  const hasLive = slots.some((s) => {
    const st = slotStatus(s, now);
    return st === "active" || st === "imminent" || st === "upcoming";
  });

  const [open, setOpen] = useState(hasLive);
  const [selectedDay, setSelectedDay] = useState(() => pickDefaultDay(dateKeys, byDate, now));

  useEffect(() => {
    if (hasLive) setOpen(true);
  }, [hasLive]);

  const lang = STAGE_LABELS[locale] ?? STAGE_LABELS.en;
  const catShort = CATEGORY_SHORT[locale] ?? CATEGORY_SHORT.en;
  const liveCount = slots.filter((s) => slotStatus(s, now) === "active").length;
  const title = locale === "sr" ? "Satnica" : "Schedule";

  const activeSlot = slots.find((s) => slotStatus(s, now) === "active");
  const nextSlot = activeSlot
    ? null
    : slots
        .filter((s) => {
          const st = slotStatus(s, now);
          return st === "imminent" || st === "upcoming" || st === "future";
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null;
  const liveHint = activeSlot ?? nextSlot;
  const liveHintIsNext = !activeSlot && !!nextSlot;
  const isImminent = !activeSlot && !!nextSlot && slotStatus(nextSlot, now) === "imminent";

  const visibleDays = usePills ? [selectedDay] : dateKeys;

  return (
    <section className="mb-8">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3 w-full text-left group mb-0"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <h2
            className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase tracking-tight text-[var(--ink)] m-0 leading-none"
            style={{ fontSize: "1.25rem", letterSpacing: "-0.02em" }}
          >
            {title}
          </h2>

          <span className="self-center text-[var(--subtle)] group-hover:text-[var(--muted)] transition-colors shrink-0">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms ease",
              }}
            >
              <path d="M2.5 5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--ink)] bg-[var(--surface-2)] px-2 py-0.5 rounded-sm">
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
              />
              {locale === "sr" ? "Uživo" : "Live"}
            </span>
          )}

          {isImminent && (
            <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--ink)] bg-[var(--surface-2)] px-2 py-0.5 rounded-sm">
              <span
                className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0"
                style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
              />
              {locale === "sr" ? "Uskoro" : "Soon"}
            </span>
          )}
        </div>

        {liveHint && (
          <span className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] translate-y-px">
            {liveHintIsNext && !isImminent && (
              <span className="text-[var(--subtle)] mr-1">
                {locale === "sr" ? "Sledeće:" : "Next:"}
              </span>
            )}
            {liveHintIsNext && isImminent && (
              <span className="text-[var(--subtle)] mr-1">
                {locale === "sr" ? "Uskoro:" : "Soon:"}
              </span>
            )}
            <span className="font-bold text-[var(--ink)]">{liveHint.disciplineCode}</span>
            {" "}
            <span className="text-[var(--muted)]">
              {(DISCIPLINE_NAMES[liveHint.disciplineCode]?.[locale as "sr" | "en"] ?? DISCIPLINE_NAMES[liveHint.disciplineCode]?.en)}
            </span>
            {" · "}
            {lang[liveHint.stage] ?? liveHint.stage}
            {liveHintIsNext && (() => {
              const ms = new Date(liveHint.startTime).getTime() - now.getTime();
              const cd = fmtCountdown(ms, locale);
              return cd ? <span className="text-[var(--subtle)] ml-1">· {cd}</span> : null;
            })()}
          </span>
        )}

      </button>

      {/* Collapsible body */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 220ms ease",
        }}
      >
        <div ref={contentRef} style={{ overflow: "hidden", minHeight: 0 }}>
          <div className="pt-4 border-t border-[var(--border)] mt-3">

            {/* Day selector pills */}
            {usePills && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {dateKeys.map((dk) => {
                  const daySlots = byDate.get(dk)!;
                  const isSelected = dk === selectedDay;
                  const hasActive = daySlots.some((s) => slotStatus(s, now) === "active");
                  const allPast = daySlots.every((s) => slotStatus(s, now) === "past");

                  return (
                    <button
                      key={dk}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedDay(dk); }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide transition-colors"
                      style={{
                        background: isSelected ? "var(--ink)" : "var(--surface-2)",
                        color: isSelected ? "var(--surface)" : allPast ? "var(--subtle)" : "var(--muted)",
                      }}
                    >
                      {hasActive && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
                          style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
                        />
                      )}
                      {fmtPillDate(dk, locale)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Slots table */}
            <table className="border-collapse text-sm">
              <tbody>
                {visibleDays.map((dk, di) => (
                  <Fragment key={dk}>
                    {!usePills && dateKeys.length > 1 && (
                      <tr key={`h-${dk}`}>
                        <td
                          colSpan={4}
                          className="pb-1.5 text-[0.68rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide text-[var(--subtle)]"
                          style={{ paddingTop: di === 0 ? 0 : "1.25rem" }}
                        >
                          {fmtPillDate(dk, locale)}
                        </td>
                      </tr>
                    )}
                    {byDate.get(dk)?.map((slot) => {
                      const st = slotStatus(slot, now);
                      const stageLabel = lang[slot.stage] ?? slot.stage;
                      const catLabel = slot.category !== "senior" ? catShort[slot.category] ?? slot.category : null;

                      return (
                        <tr key={slot.id} style={{ opacity: st === "past" ? 0.45 : 1 }}>
                          <td className="w-5 py-1 pr-2 align-middle">
                            <span className="flex items-center justify-center w-4">
                              {st === "active" ? (
                                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }} />
                              ) : st === "imminent" ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }} />
                              ) : st === "upcoming" ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink)] shrink-0" />
                              ) : st === "past" ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--subtle)] shrink-0" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)] shrink-0" />
                              )}
                            </span>
                          </td>
                          <td className="py-1 pr-4 align-top whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">
                            <div className="flex items-baseline gap-1 text-[var(--ink)]">
                              {fmtTime(slot.startTime)}
                              {slot.endTime && (
                                <span className="text-[var(--subtle)]">– {fmtTime(slot.endTime)}</span>
                              )}
                            </div>
                            {showDualTime && (
                              <div className="flex items-baseline gap-1 text-[0.68rem] text-[var(--subtle)] leading-tight mt-0.5">
                                {fmtTime(slot.startTime, timezone)}
                                {slot.endTime && <span>– {fmtTime(slot.endTime, timezone)}</span>}
                                <span className="opacity-70">{tzDiff(slot.startTime, timezone)}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-1 pr-4 align-middle whitespace-nowrap font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] tracking-wide">
                            {slot.disciplineCode}
                          </td>
                          <td className="py-1 align-middle text-[var(--muted)] text-xs">
                            {stageLabel}
                            {catLabel && <span className="ml-1.5 text-[var(--subtle)]">{catLabel}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.75); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="pulse-dot"] { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
