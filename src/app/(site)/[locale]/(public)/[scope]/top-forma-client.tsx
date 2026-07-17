"use client";

import React, { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Sparkline } from "@/components/sparkline";
import { FormaScoreInfo } from "@/components/shooter/FormaScoreHeading";
import { trendLabel, trendColor } from "@/lib/forma";
import { useLocale, useTranslations } from "next-intl";
import { useScopedHref } from "@/hooks/use-scoped-href";

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
  const t = useTranslations("home");
  const locale = useLocale();
  const scopedHref = useScopedHref();

  const rows = initialData[activeTab];
  const isAP = activeTab.startsWith("AP");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      {/* Widget Header with Tabs */}
      <div className="bg-[var(--brand-primary)] px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]">
        <h3 className="flex items-center gap-1 font-[family-name:var(--font-barlow-condensed)] text-lg font-bold uppercase tracking-wider text-white">
          <span>{t("topForm")}</span>
          <FormaScoreInfo locale={locale} inverted />
        </h3>
        
        <div className="flex gap-0.5 rounded bg-[rgba(255,255,255,0.1)] p-0.5" role="group" aria-label={t("topForm")}>
          {TABS.map((tab) => {
            const active = activeTab === tab.code;
            return (
              <button
                key={tab.code}
                onClick={() => setActiveTab(tab.code)}
                aria-pressed={active}
                className="min-h-10 min-w-11 rounded px-2.5 py-1 text-xs font-semibold uppercase transition-colors"
                style={{
                  background: active ? "var(--bg)" : "transparent",
                  color: active ? "var(--brand-primary)" : "white",
                }}
              >
                {tab.code}
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--muted)]">Nema unetih rezultata za ovu disciplinu.</p>
        </div>
      ) : <>
      <ol className="divide-y divide-[var(--border)] sm:hidden" aria-label={t("topForm")}>
        {rows.map((r, i) => (
          <li key={r.shooterId} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className="w-5 text-right font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[var(--subtle)]">{i + 1}</span>
            <Link href={scopedHref(`/strelci/${r.shooterId}`)} className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)] hover:underline">
              {r.lastName} {r.firstName}
            </Link>
            <span className="text-base font-bold leading-none font-mono" style={{ color: trendColor(r.trend) }} aria-label={r.trend}>
              {trendLabel(r.trend)}
            </span>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-base font-semibold text-[var(--ink)]">{r.formaScore.toFixed(1)}</span>
          </li>
        ))}
      </ol>

      <div className="hidden overflow-x-auto sm:block" role="region" tabIndex={0} aria-label={t("topForm")}>
          <table className="min-w-[680px] w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th scope="col" className="w-10 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--muted)]">#</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                <th scope="col" className="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Trend</th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Forma</th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Peak</th>
                <th scope="col" className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Momenta (Zadnjih 5)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r, i) => (
                <tr key={r.shooterId} className="hover:bg-[var(--surface)] transition-colors">
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
                  <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">
                    {r.formaScore.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                    {r.peak ? r.peak.toFixed(isAP ? 0 : 1) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center align-middle">
                    <Sparkline scores={r.recentScores.slice(0, 5)} />
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
