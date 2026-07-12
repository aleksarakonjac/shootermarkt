"use client";

import React, { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Sparkline } from "@/components/sparkline";
import { trendLabel, trendColor } from "@/lib/forma";
import { useTranslations } from "next-intl";
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
  const scopedHref = useScopedHref();

  const rows = initialData[activeTab];
  const isAP = activeTab.startsWith("AP");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      {/* Widget Header with Tabs */}
      <div className="bg-[var(--brand-primary)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
          {t("topForm")}
        </h3>
        
        {/* Tabs switcher */}
        <div className="flex gap-0.5 p-0.5 rounded bg-[rgba(255,255,255,0.1)]">
          {TABS.map((tab) => {
            const active = activeTab === tab.code;
            return (
              <button
                key={tab.code}
                onClick={() => setActiveTab(tab.code)}
                className="px-2.5 py-1 rounded text-xs font-semibold uppercase transition-colors"
                style={{
                  background: active ? "var(--bg)" : "transparent",
                  color: active ? "var(--brand-primary)" : "rgba(255, 255, 255, 0.7)",
                }}
              >
                {tab.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--muted)]">Nema unetih rezultata za ovu disciplinu.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="w-10 px-3 py-2.5 text-right text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">#</th>
                <th className="px-3 py-2.5 text-left text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                <th className="px-3 py-2.5 text-left text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                <th className="px-3 py-2.5 text-center text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">Trend</th>
                <th className="px-3 py-2.5 text-right text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">Forma</th>
                <th className="px-3 py-2.5 text-right text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">Peak</th>
                <th className="px-4 py-2.5 text-center text-[0.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">Momenta (Zadnjih 5)</th>
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
        )}
      </div>
      
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
