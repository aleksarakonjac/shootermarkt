"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { TransitionLink } from "@/components/shooter/TransitionLink";
import { Sparkline } from "@/components/sparkline";
import { FormaScoreInfo } from "@/components/shooter/FormaScoreHeading";
import { FormaScoreMark } from "@/components/shooter/FormaScoreMark";
import { trendLabel, trendColor } from "@/lib/forma";
import { useLocale, useTranslations } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";

const ROTATE_INTERVAL = 9_000;
const RESUME_DELAY = 3 * 60 * 1_000;

interface ShooterFormRow {
  shooterId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  countryCode2: string | null;
  formaScore: number;
  trend: "up" | "down" | "stable";
  peak: number | null;
  entriesCount: number;
  recentScores: number[];
}

const Affil = ({ r }: { r: ShooterFormRow }) => r.nationality ? (
  <span className="inline-flex shrink-0 items-center gap-1">
    {r.countryCode2 && <span className={`fi fi-${r.countryCode2.toLowerCase()}`} style={{ fontSize: 11 }} aria-hidden="true" />}
    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold text-[var(--muted)]">{r.nationality}</span>
  </span>
) : null;

const TABS = [
  { code: "ARM", sr: "10m puška M", en: "Air Rifle M" },
  { code: "ARW", sr: "10m puška Ž", en: "Air Rifle W" },
  { code: "APM", sr: "10m pištolj M", en: "Air Pistol M" },
  { code: "APW", sr: "10m pištolj Ž", en: "Air Pistol W" },
  { code: "R3PM", sr: "50m puška M", en: "Rifle 3x20 M" },
  { code: "R3PW", sr: "50m puška Ž", en: "Rifle 3x20 W" },
  { code: "SPW", sr: "25m pištolj Ž", en: "25m Pistol W" },
  { code: "RFPM", sr: "25m Rapid Fire M", en: "25m Rapid Fire M" },
] as const;

type TabCode = (typeof TABS)[number]["code"];

interface TopFormaClientProps {
  initialData: Record<TabCode, ShooterFormRow[]>;
}

const ROLL_DURATION = 450;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Forma broj "ruloira" ka vrednosti kad se tab promeni; bez animacije pri prvom prikazu i uz reduced motion. */
function RollingNumber({ value, animate }: { value: number; animate: boolean }) {
  const [shown, setShown] = useState(value);
  useLayoutEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const from = value - value * 0.01;
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - startedAt) / ROLL_DURATION);
      setShown(from + (value - from) * (1 - Math.pow(1 - progress, 4)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    setShown(from);
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);
  return <span className="tabular-nums">{shown.toFixed(1)}</span>;
}

function TriggerLabel({ tab, en }: { tab: (typeof TABS)[number]; en: boolean }) {
  return (
    <>
      <span className="inline-flex h-4 min-w-9 max-w-[2.75rem] shrink-0 grow items-center justify-center rounded-[3px] bg-[var(--brand-primary)] px-1 text-xs sm:text-[11px] leading-none font-[family-name:var(--font-jetbrains-mono)] font-bold text-white">{tab.code}</span>
      <span aria-hidden="true" className="h-0 min-w-1.5 max-w-4 grow" />
      <span className="min-w-0 truncate text-[13px] leading-none sm:text-xs font-medium">{en ? tab.en : tab.sr}</span>
    </>
  );
}

function DisciplineSelect({ tabs, active, locale, label, onSelect, onOpen }: {
  tabs: readonly (typeof TABS)[number][];
  active: TabCode;
  locale: string;
  label: string;
  onSelect: (code: TabCode) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const en = locale === "en";
  const current = tabs.find((tab) => tab.code === active) ?? tabs[0];

  // Klizanje: prethodna disciplina izlazi nagore dok nova ulazi odozdo (rotacija i ručni izbor).
  const [slide, setSlide] = useState<{ cur: TabCode; prev: TabCode | null }>({ cur: current.code, prev: null });
  if (slide.cur !== current.code) setSlide({ cur: current.code, prev: slide.cur });
  const prevTab = slide.prev ? TABS.find((tab) => tab.code === slide.prev) : undefined;
  useEffect(() => {
    if (!slide.prev) return;
    const timer = setTimeout(() => setSlide((cur) => ({ ...cur, prev: null })), 320);
    return () => clearTimeout(timer);
  }, [slide]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && open) {
      setOpen(false);
      triggerRef.current?.focus();
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && open) {
      event.preventDefault();
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-disc-option]") ?? []);
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "ArrowDown" ? at + 1 : at - 1;
      items[(next + items.length) % items.length]?.focus();
    }
  }

  const ink = "text-[oklch(0.22_0.012_28)]";
  return (
    // Wrapper rezerviše mesto trigera (24px); bela kartica iznad njega raste naniže i sadrži i trigger i listu.
    <div ref={rootRef} className={`relative ml-auto h-6 min-w-0 flex-1 sm:flex-none max-w-[10.5rem] sm:w-[10.5rem]`} onKeyDown={onKeyDown}>
      <div
        className={`absolute right-0 top-0 z-30 w-full overflow-hidden rounded bg-white transition-shadow duration-200 ease-out ${ink} ${open ? "shadow-lg shadow-black/25" : ""}`}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={label}
          onClick={() => { if (!open) onOpen(); setOpen((o) => !o); }}
          className="flex h-6 w-full items-center gap-1.5 pl-1 pr-1.5 text-left text-[13px] sm:text-xs font-semibold"
        >
          <span className="grid h-4 min-w-0 flex-1 overflow-hidden">
            {prevTab && (
              <span key={`out-${prevTab.code}`} aria-hidden="true" className="tf-slide-out col-start-1 row-start-1 flex min-w-0 items-center">
                <TriggerLabel tab={prevTab} en={en} />
              </span>
            )}
            <span key={current.code} className={`${prevTab ? "tf-slide-in " : ""}col-start-1 row-start-1 flex min-w-0 items-center`}>
              <TriggerLabel tab={current} en={en} />
            </span>
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* grid-rows 0fr→1fr = animirana visina; invisible kad je zatvoreno da opcije ne primaju fokus */}
        <div className={`tf-menu grid transition-[grid-template-rows,visibility] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
          <ul className="min-h-0 overflow-hidden border-t border-black/10">
            {tabs.map((tab) => {
              const selected = tab.code === active;
              return (
                <li key={tab.code}>
                  <button
                    type="button"
                    data-disc-option
                    aria-current={selected ? "true" : undefined}
                    onClick={() => { onSelect(tab.code); setOpen(false); triggerRef.current?.focus(); }}
                    className={`flex min-h-10 w-full items-center gap-2 py-1.5 pl-1 pr-2 text-left text-[13px] sm:text-xs transition-colors hover:bg-black/[0.05] focus-visible:bg-black/[0.05] ${selected ? "bg-black/[0.05] font-semibold" : "font-medium"}`}
                  >
                    <span className="inline-flex h-4 min-w-9 shrink-0 items-center justify-center rounded-[3px] bg-[var(--brand-primary)] px-1 font-[family-name:var(--font-jetbrains-mono)] text-xs sm:text-[11px] font-bold leading-none text-white">{tab.code}</span>
                    <span className="min-w-0 flex-1 leading-tight">{en ? tab.en : tab.sr}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function TopFormaClient({ initialData }: TopFormaClientProps) {
  // Samo discipline sa podacima; ako nijedna nema, prikaži sve (empty state).
  const populated = TABS.filter((tab) => (initialData[tab.code]?.length ?? 0) > 0);
  const tabs = populated.length ? populated : TABS;
  const [activeTab, setActiveTab] = useState<TabCode>(tabs[0].code);
  const [userSelected, setUserSelected] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [switched, setSwitched] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations("home");
  const locale = useLocale();
  const scopedHref = useScopedHref();
  const reducedMotion = usePrefersReducedMotion();

  // Rotacija stoji dok korisnik čita (hover, fokus, dodir, klik na tab) i nikad ne radi uz reduced motion.
  const rotating = !reducedMotion && !hovered && !focused && !userSelected;

  useEffect(() => {
    if (!rotating) return;
    const interval = setInterval(() => {
      setActiveTab((cur) => tabs[(tabs.findIndex((tab) => tab.code === cur) + 1) % tabs.length].code);
      setSwitched(true);
    }, ROTATE_INTERVAL);
    return () => clearInterval(interval);
  }, [rotating, tabs]);

  const holdRotation = useCallback(() => {
    setUserSelected(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setUserSelected(false), RESUME_DELAY);
  }, []);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  function handleTabClick(code: TabCode) {
    setActiveTab(code);
    setSwitched(true);
    holdRotation();
  }

  const rows = initialData[activeTab];
  const isAP = activeTab !== "ARM" && activeTab !== "ARW"; // celobrojni skorovi

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--bg)]"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onTouchStart={holdRotation}
    >
      {/* Widget Header with Tabs */}
      <div className="relative flex flex-nowrap items-center justify-between gap-2 rounded-t-[calc(0.75rem-1px)] border-b border-[var(--border)] bg-[var(--brand-primary)] px-4 py-1.5">
        <h3 className="flex min-h-8 shrink-0 items-center gap-1.5 leading-none font-[family-name:var(--font-barlow-condensed)] text-base font-bold uppercase tracking-wider text-white sm:text-lg">
          <span>Top</span>
          <span className="inline-flex h-6 items-center gap-1 rounded bg-white/95 px-1.5" style={{ "--ink": "oklch(0.22 0.012 28)" } as React.CSSProperties}>
            <FormaScoreMark size="md" style={{ display: "inline-block", transform: "translateY(-2px)" }} />
            <FormaScoreInfo locale={locale} buttonMarginTop={0} />
          </span>
        </h3>

        <DisciplineSelect tabs={tabs} active={activeTab} locale={locale} label={t("topForm")} onSelect={handleTabClick} onOpen={holdRotation} />

        {rotating && (
          <span
            key={activeTab}
            aria-hidden="true"
            className="tf-progress absolute bottom-0 left-0 h-[2px] w-full bg-white/30"
            style={{ "--tf-interval": `${ROTATE_INTERVAL}ms` } as React.CSSProperties}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--muted)]">{locale === "en" ? "No results entered for this event." : "Nema unetih rezultata za ovu disciplinu."}</p>
        </div>
      ) : <>
      <ol key={activeTab} className="divide-y divide-[var(--border)] sm:hidden" aria-label={t("topForm")}>
        {rows.map((r, i) => (
          <li
            key={r.shooterId}
            className="tf-row flex min-h-14 items-center gap-2 px-3 py-2"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="w-5 text-right font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[var(--muted)]">{i + 1}</span>
            <TransitionLink transitionName="shooter-name" href={scopedHref(`/strelci/${r.shooterId}`)} className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)] hover:underline">
              {r.lastName} {r.firstName}
            </TransitionLink>
            <Affil r={r} />
            <Sparkline scores={r.recentScores.slice(0, 5)} width={44} height={18} strokeWidth={1.5} draw={switched && i < 3} />
            <span className="flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-base font-semibold text-[var(--ink)]">
              <RollingNumber value={r.formaScore} animate={switched && i < 3} />
              <span className="text-base font-bold leading-none" style={{ color: trendColor(r.trend) }} aria-label={r.trend}>{trendLabel(r.trend)}</span>
            </span>
          </li>
        ))}
      </ol>

      <div key={`table-${activeTab}`} className="hidden overflow-x-auto sm:block" role="region" tabIndex={0} aria-label={t("topForm")}>
          <table className="min-w-[600px] w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th scope="col" className="w-10 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--muted)]">#</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{locale === "en" ? "Shooter" : "Strelac"}</th>
                <th scope="col" className="px-3 py-2.5 text-right"><FormaScoreMark size="sm" /></th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Peak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r, i) => (
                <tr
                  key={r.shooterId}
                  className="tf-row hover:bg-[var(--surface)] transition-colors"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <td className="w-10 px-3 py-2.5 text-right font-[family-name:var(--font-barlow-condensed)] font-bold text-base text-[var(--muted)]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <TransitionLink
                        transitionName="shooter-name"
                        href={scopedHref(`/strelci/${r.shooterId}`)}
                        className="font-semibold text-[var(--ink)] hover:underline block truncate max-w-[150px] sm:max-w-none"
                      >
                        {r.lastName} {r.firstName}
                      </TransitionLink>
                      <Affil r={r} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Sparkline scores={r.recentScores.slice(0, 5)} width={56} height={20} strokeWidth={1.5} draw={switched && i < 3} />
                      <span className="flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">
                        <RollingNumber value={r.formaScore} animate={switched && i < 3} />
                        <span className="text-sm font-bold leading-none" style={{ color: trendColor(r.trend) }} aria-label={r.trend}>{trendLabel(r.trend)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                    {r.peak ? r.peak.toFixed(isAP ? 0 : 1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      </>}
      
      <div className="rounded-b-[calc(0.75rem-1px)] bg-[var(--surface)] px-4 py-2.5 text-right border-t border-[var(--border)]">
        <Link
          href={scopedHref(`/rangiranje?disciplina=${activeTab.toLowerCase()}`)}
          className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
        >
          {locale === "en" ? `View full rankings (${activeTab})` : `Pogledaj celo rangiranje (${activeTab})`} →
        </Link>
      </div>
    </div>
  );
}
