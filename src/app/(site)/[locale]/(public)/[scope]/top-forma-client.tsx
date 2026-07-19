"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Sparkline } from "@/components/sparkline";
import { FormaScoreInfo } from "@/components/shooter/FormaScoreHeading";
import { FormaScoreMark } from "@/components/shooter/FormaScoreMark";
import { trendLabel, trendColor } from "@/lib/forma";
import { useLocale, useTranslations } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";

const ROTATE_INTERVAL = 5_000;
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

export function TopFormaClient({ initialData }: TopFormaClientProps) {
  const [activeTab, setActiveTab] = useState<keyof typeof initialData>("ARM");
  const [userSelected, setUserSelected] = useState(false);
  const rotateTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations("home");
  const locale = useLocale();
  const scopedHref = useScopedHref();

  const stopRotation = useCallback(() => {
    if (rotateTimer.current) clearInterval(rotateTimer.current);
    rotateTimer.current = null;
  }, []);

  const clearResume = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
  }, []);

  const startRotation = useCallback(() => {
    stopRotation();
    rotateTimer.current = setInterval(() => {
      setActiveTab((cur) => {
        const idx = TABS.findIndex((t) => t.code === cur);
        return TABS[(idx + 1) % TABS.length].code;
      });
    }, ROTATE_INTERVAL);
  }, [stopRotation]);

  useEffect(() => {
    startRotation();
    return () => { stopRotation(); clearResume(); };
  }, [startRotation, stopRotation, clearResume]);

  function handleTabClick(code: keyof typeof initialData) {
    setActiveTab(code);
    setUserSelected(true);
    stopRotation();
    clearResume();
    resumeTimer.current = setTimeout(() => {
      setUserSelected(false);
      startRotation();
    }, RESUME_DELAY);
  }

  const rows = initialData[activeTab];
  const isAP = activeTab.startsWith("AP");
  const activeIndex = TABS.findIndex((t) => t.code === activeTab);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <style>{`
        @keyframes _tf-enter {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes _tf-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        ._tf-pill { transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1); }
        @media (prefers-reduced-motion: reduce) {
          @keyframes _tf-enter    { from { opacity: 1; transform: none; } }
          @keyframes _tf-progress { from { transform: scaleX(1); } }
          ._tf-pill { transition: none; }
        }
      `}</style>
      {/* Widget Header with Tabs */}
      <div className="relative flex flex-nowrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--brand-primary)] px-4 py-2">
        <h3 className="flex shrink-0 items-center gap-1.5 font-[family-name:var(--font-barlow-condensed)] text-base font-bold uppercase tracking-wider text-white sm:text-lg">
          <span>Top</span>
          <span className="inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5">
            <FormaScoreMark size="md" />
            <FormaScoreInfo locale={locale} buttonMarginTop={0} />
          </span>
        </h3>

        <div className="relative flex shrink-0 overflow-hidden rounded bg-[rgba(255,255,255,0.1)]" role="group" aria-label={t("topForm")}>
          {/* Sliding pill indicator */}
          <span
            aria-hidden="true"
            className="_tf-pill pointer-events-none absolute top-0 bottom-0 left-0 rounded"
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
                className="relative z-10 min-h-10 flex-1 rounded px-2.5 py-1 text-xs font-semibold uppercase transition-[color,transform] duration-150 active:scale-95"
                style={{ color: active ? "var(--brand-primary)" : "rgba(255,255,255,0.85)" }}
              >
                {tab.code}
              </button>
            );
          })}
        </div>

        {!userSelected && (
          <span
            key={activeTab}
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-white/30"
            style={{ animation: `_tf-progress ${ROTATE_INTERVAL}ms linear 1 forwards` }}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--muted)]">Nema unetih rezultata za ovu disciplinu.</p>
        </div>
      ) : <>
      <ol key={activeTab} className="divide-y divide-[var(--border)] sm:hidden" aria-label={t("topForm")}>
        {rows.map((r, i) => (
          <li
            key={r.shooterId}
            className="flex min-h-14 items-center gap-2 px-3 py-2"
            style={{ animation: `_tf-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both`, animationDelay: `${i * 35}ms` }}
          >
            <span className="w-5 text-right font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[var(--subtle)]">{i + 1}</span>
            <Link href={scopedHref(`/strelci/${r.shooterId}`)} className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)] hover:underline">
              {r.lastName} {r.firstName}
            </Link>
            <Sparkline scores={r.recentScores.slice(0, 5)} width={44} height={18} strokeWidth={1.5} />
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-base font-semibold text-[var(--ink)]">{r.formaScore.toFixed(1)}</span>
            <span className="w-5 text-center text-base font-bold leading-none font-mono" style={{ color: trendColor(r.trend) }} aria-label={r.trend}>
              {trendLabel(r.trend)}
            </span>
          </li>
        ))}
      </ol>

      <div key={`table-${activeTab}`} className="hidden overflow-x-auto sm:block" role="region" tabIndex={0} aria-label={t("topForm")}>
          <table className="min-w-[680px] w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th scope="col" className="w-10 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--muted)]">#</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                <th scope="col" className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Trend</th>
                <th scope="col" className="px-3 py-2.5 text-right"><FormaScoreMark size="sm" /></th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Peak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r, i) => (
                <tr
                  key={r.shooterId}
                  className="hover:bg-[var(--surface)] transition-colors"
                  style={{ animation: `_tf-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both`, animationDelay: `${i * 35}ms` }}
                >
                  <td className="w-10 px-3 py-2.5 text-right font-[family-name:var(--font-barlow-condensed)] font-bold text-base text-[var(--subtle)]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={scopedHref(`/strelci/${r.shooterId}`)}
                      className="font-semibold text-[var(--ink)] hover:underline block truncate max-w-[150px] sm:max-w-none"
                    >
                      {r.lastName} {r.firstName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)] text-xs truncate max-w-[120px] sm:max-w-none">
                    {r.clubName ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className="inline-block text-sm font-bold leading-none font-mono"
                      style={{ color: trendColor(r.trend) }}
                    >
                      {trendLabel(r.trend)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Sparkline scores={r.recentScores.slice(0, 5)} width={56} height={20} strokeWidth={1.5} />
                      <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">{r.formaScore.toFixed(1)}</span>
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
          Pogledaj celo rangiranje ({activeTab}) →
        </Link>
      </div>
    </div>
  );
}
