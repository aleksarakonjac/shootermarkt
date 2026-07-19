"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { trendColor, trendLabel, type Trend } from "@/lib/forma";
import { DisciplineSelector } from "./DisciplineSelector";
import { FormaScoreInfo } from "./FormaScoreHeading";

export type CareerStat = {
  code: string;
  name: string;
  careerCount: number;
  forma: number | null;
  peak: number | null;
  best3: number | null;
  recent3: number | null;
  season: number | null;
  seasonCount: number;
  improvement: number | null;
  trend: Trend | null;
};

function StatLabel({ label, description, locale, align }: { label: string; description: string; locale: string; align: "left" | "center" | "right" }) {
  return (
    <div className="mb-1.5 flex items-center gap-1">
      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] font-[family-name:var(--font-barlow-condensed)] leading-none">{label}</p>
      <FormaScoreInfo locale={locale} heading={label} description={description} ariaLabel={label} align={align} placement="top" />
    </div>
  );
}

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
  const valueClass = "font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)] leading-none";
  const info = locale === "en" ? {
    form: "FORMAScore is the forecast of the next result, based on recent performances and their trend.",
    peak: "The best qualification result achieved in this discipline.",
    best3: "The average of the three best qualification results in this discipline.",
    recent3: "The average of the last three qualification results in this discipline.",
    season: "The average qualification result in the current season. The number after the slash is the number of starts.",
    improvement: "The difference between this season's average and the previous season's average.",
  } : {
    form: "FORMAScore je prognoza sledećeg rezultata, zasnovana na novijim nastupima i njihovom trendu.",
    peak: "Najbolji ostvareni kvalifikacioni rezultat u ovoj disciplini.",
    best3: "Prosek tri najbolja kvalifikaciona rezultata u ovoj disciplini.",
    recent3: "Prosek poslednja tri kvalifikaciona rezultata u ovoj disciplini.",
    season: "Prosek kvalifikacionih rezultata u tekućoj sezoni. Broj posle kose crte je broj nastupa.",
    improvement: "Razlika između proseka ove i prethodne sezone.",
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
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

      <div className="grid grid-cols-3 gap-px bg-[var(--border)] lg:grid-cols-6">
        <div className="bg-[var(--surface)] px-4 py-3 sm:col-span-1">
          <StatLabel label={t("form")} description={info.form} locale={locale} align="left" />
          {stat.forma !== null ? (
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className={`${valueClass} text-xl`}>{fmtNum(stat.forma)}</span>
              {stat.trend && <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold" style={{ color: trendColor(stat.trend) }}>{trendLabel(stat.trend)}</span>}
            </div>
          ) : <span className={`${valueClass} text-xl text-[var(--subtle)]`}>—</span>}
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <StatLabel label={t("statPeak")} description={info.peak} locale={locale} align="center" />
          <span className={`${valueClass} mt-0.5 block text-base`}>{fmtNum(stat.peak)}</span>
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <StatLabel label={t("statBest3")} description={info.best3} locale={locale} align="right" />
          <span className={`${valueClass} mt-0.5 block text-base`}>{fmtNum(stat.best3)}</span>
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <StatLabel label={locale === "en" ? "Last 3" : "Poslednja 3"} description={info.recent3} locale={locale} align="left" />
          <span className={`${valueClass} mt-0.5 block text-base`}>{fmtNum(stat.recent3)}</span>
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <StatLabel label={t("statSezonaProsek")} description={info.season} locale={locale} align="center" />
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className={`${valueClass} text-base`}>{fmtNum(stat.season)}</span>
            {stat.season !== null && stat.seasonCount > 0 && <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)]">/{stat.seasonCount}</span>}
          </div>
        </div>
        <div className="bg-[var(--surface)] px-4 py-3">
          <StatLabel label={t("statNapredak")} description={info.improvement} locale={locale} align="right" />
          <span className={`${valueClass} mt-0.5 block text-base`} style={{ color: deltaColor }}>
            {stat.improvement === null ? "—" : `${stat.improvement > 0 ? "+" : ""}${fmtNum(stat.improvement)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
