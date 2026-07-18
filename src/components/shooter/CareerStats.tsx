"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trendColor, trendLabel, type Trend } from "@/lib/forma";
import { DisciplineSelector } from "./DisciplineSelector";

export type CareerStat = {
  code: string;
  name: string;
  careerCount: number;
  forma: number | null;
  peak: number | null;
  best3: number | null;
  season: number | null;
  seasonCount: number;
  improvement: number | null;
  trend: Trend | null;
};

export function CareerStats({ stats, locale }: { stats: CareerStat[]; locale: string }) {
  const t = useTranslations("shooters.profile");
  const [selectedCode, setSelectedCode] = useState(stats[0]?.code ?? "");
  const stat = stats.find((item) => item.code === selectedCode) ?? stats[0];

  if (!stat) return null;

  const fmtNum = (value: number | null, decimals = 1) =>
    value === null ? "—" : value % 1 === 0 ? String(value) : value.toFixed(decimals);
  const deltaColor =
    stat.improvement === null ? "var(--subtle)"
    : stat.improvement > 0 ? "var(--success)"
    : stat.improvement < 0 ? "var(--brand-primary)"
    : "var(--muted)";
  const labelClass = "text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] font-[family-name:var(--font-barlow-condensed)] leading-none mb-1.5";
  const valueClass = "font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)] leading-none";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
        {stats.length > 1 ? (
          <DisciplineSelector options={stats.map(({ code, name }) => ({ code, label: name }))} value={stat.code} onChange={setSelectedCode} locale={locale} showLabel />
        ) : (
          <>
            <span className="rounded bg-[var(--ink)] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold text-white">{stat.code}</span>
            <span className="text-sm font-medium text-[var(--muted)]">{stat.name}</span>
          </>
        )}
        <span className="ml-auto shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--subtle)]">
          {stat.careerCount} {t("statUkupnoNastupa").toLowerCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-[var(--border)] sm:grid-cols-5">
        <div className="bg-[var(--surface)] px-4 py-3 sm:col-span-1">
          <p className={labelClass}>{t("form")}</p>
          {stat.forma !== null ? (
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className={`${valueClass} text-xl`}>{fmtNum(stat.forma)}</span>
              {stat.trend && <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold" style={{ color: trendColor(stat.trend) }}>{trendLabel(stat.trend)}</span>}
            </div>
          ) : <span className={`${valueClass} text-xl text-[var(--subtle)]`}>—</span>}
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <p className={labelClass}>{t("statPeak")}</p>
          <span className={`${valueClass} mt-0.5 block text-base`}>{fmtNum(stat.peak)}</span>
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <p className={labelClass}>{t("statBest3")}</p>
          <span className={`${valueClass} mt-0.5 block text-base`}>{fmtNum(stat.best3)}</span>
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <p className={labelClass}>{t("statSezonaProsek")}</p>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className={`${valueClass} text-base`}>{fmtNum(stat.season)}</span>
            {stat.season !== null && stat.seasonCount > 0 && <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)]">/{stat.seasonCount}</span>}
          </div>
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <p className={labelClass}>{t("statNapredak")}</p>
          <span className={`${valueClass} mt-0.5 block text-base`} style={{ color: deltaColor }}>
            {stat.improvement === null ? "—" : `${stat.improvement > 0 ? "+" : ""}${fmtNum(stat.improvement)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
