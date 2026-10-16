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
  clubName: string | null;
  nationality: string | null;
  formaScore: number;
  trend: "up" | "down" | "stable";
  peak: number | null;
  entriesCount: number;
  recentScores: number[];
}

interface TopFormaClientProps {
  initialData: {
    ARM: ShooterFormRow[];
    ARW: ShooterFormRow[];
    APM: ShooterFormRow[];
    APW: ShooterFormRow[];
  };
}

const TABS = [
  { code: "ARM", name: "Rifle Men" },
  { code: "ARW", name: "Rifle Women" },
  { code: "APM", name: "Pistol Men" },
  { code: "APW", name: "Pistol Women" },
] as const;

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

export function TopFormaClient({ initialData }: TopFormaClientProps) {
  const [activeTab, setActiveTab] = useState<keyof typeof initialData>("ARM");
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
      setActiveTab((cur) => TABS[(TABS.findIndex((tab) => tab.code === cur) + 1) % TABS.length].code);
      setSwitched(true);
    }, ROTATE_INTERVAL);
    return () => clearInterval(interval);
  }, [rotating]);

  const holdRotation = useCallback(() => {
    setUserSelected(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setUserSelected(false), RESUME_DELAY);
  }, []);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  function handleTabClick(code: keyof typeof initialData) {
    setActiveTab(code);
    setSwitched(true);
    holdRotation();
  }

  const rows = initialData[activeTab];
  const isAP = activeTab.startsWith("AP");
  const activeIndex = TABS.findIndex((t) => t.code === activeTab);

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onTouchStart={holdRotation}
    >
      {/* Widget Header with Tabs */}
      <div className="relative flex flex-nowrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--brand-primary)] px-4 py-1.5">
        <h3 className="flex min-h-8 shrink-0 items-center gap-1.5 leading-none font-[family-name:var(--font-barlow-condensed)] text-base font-bold uppercase tracking-wider text-white sm:text-lg">
          <span>Top</span>
          <span className="inline-flex h-6 items-center gap-1 rounded bg-white/95 px-1.5">
            <FormaScoreMark size="md" />
            <FormaScoreInfo locale={locale} buttonMarginTop={0} />
          </span>
        </h3>

        <div className="relative flex shrink-0 overflow-hidden rounded bg-[rgba(255,255,255,0.1)]" role="group" aria-label={t("topForm")}>
          {/* Sliding pill indicator */}
          <span
            aria-hidden="true"
            className="tf-pill pointer-events-none absolute top-0 bottom-0 left-0 rounded"
            style={{
              width: `${100 / TABS.length}%`,
              background: "var(--bg)",
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />
          {TABS.map((tab) => {
            const active = activeTab === tab.code;
            return (
              <button
                key={tab.code}
                onClick={() => handleTabClick(tab.code)}
                aria-pressed={active}
                className="relative z-10 min-h-8 flex-1 rounded px-2.5 py-1 text-xs font-semibold uppercase transition-[color,transform] duration-150 active:scale-95"
                style={{ color: active ? "var(--brand-primary)" : "rgba(255,255,255,0.85)" }}
              >
                {tab.code}
              </button>
            );
          })}
        </div>

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
            <span className="w-5 text-right font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[var(--subtle)]">{i + 1}</span>
            <TransitionLink transitionName="shooter-name" href={scopedHref(`/strelci/${r.shooterId}`)} className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)] hover:underline">
              {r.lastName} {r.firstName}
            </TransitionLink>
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
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{locale === "en" ? "Club" : "Klub"}</th>
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
                  <td className="w-10 px-3 py-2.5 text-right font-[family-name:var(--font-barlow-condensed)] font-bold text-base text-[var(--subtle)]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <TransitionLink
                      transitionName="shooter-name"
                      href={scopedHref(`/strelci/${r.shooterId}`)}
                      className="font-semibold text-[var(--ink)] hover:underline block truncate max-w-[150px] sm:max-w-none"
                    >
                      {r.lastName} {r.firstName}
                    </TransitionLink>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)] text-xs truncate max-w-[120px] sm:max-w-none">
                    {r.clubName ?? "—"}
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
      
      <div className="bg-[var(--surface)] px-4 py-2.5 text-right border-t border-[var(--border)]">
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
