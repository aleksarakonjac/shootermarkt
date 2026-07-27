"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Ticker, type TickerItem } from "../ticker";
import { createClient } from "@/lib/supabase/client";
import { UpcomingEvents } from "../components/UpcomingEvents";
import { ScopedLink } from "../components/ScopedLink";
import { TopFormaClient } from "./top-forma-client";
import { useHomepageDataStatus } from "./homepage-data-status";
import { LEVEL_STYLE } from "@/lib/competition-utils";

const FALLBACK_LEVEL_STYLE = { background: "var(--level-club-bg)", color: "var(--level-club-fg)" };
const INTL_LEVELS = new Set(["olympic", "world", "continental", "international"]);

function useHomepageData<T>(path: string, refreshMs?: number) {
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const autoRetried = useRef<string | null>(null);
  const { clearFailure, reportFailure } = useHomepageDataStatus();
  const retry = useCallback(() => {
    setState("loading");
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    clearFailure(path);
    fetch(`${path}?scope=${scope ?? "srb"}&locale=${locale}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Homepage request failed")))
      .then((result) => { setData(result); setState("ready"); clearFailure(path); })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
        reportFailure(path, retry);
      });
    return () => controller.abort();
  }, [attempt, clearFailure, locale, path, reportFailure, retry, scope]);

  useEffect(() => {
    const key = `${path}:${scope}:${locale}`;
    if (state !== "error" || autoRetried.current === key) return;
    autoRetried.current = key;
    const timeout = window.setTimeout(retry, 3_000);
    return () => window.clearTimeout(timeout);
  }, [locale, path, retry, scope, state]);

  useEffect(() => {
    if (!refreshMs) return;
    const interval = window.setInterval(() => setAttempt((value) => value + 1), refreshMs);
    return () => window.clearInterval(interval);
  }, [refreshMs]);

  return { data, state, retry };
}

function HomepageError({ retry, compact = false }: { retry: () => void; compact?: boolean }) {
  const common = useTranslations("common");
  return (
    <div className={compact ? "flex h-10 items-center justify-center gap-3 bg-[var(--surface)] text-xs" : "flex h-48 flex-col items-center justify-center gap-3 rounded-xl bg-[var(--surface)] text-sm"} role="alert">
      <span className="text-[var(--muted)]">{common("error")}</span>
      <button type="button" onClick={retry} className="font-semibold text-[var(--brand-primary)] hover:underline">
        {common("retry")}
      </button>
    </div>
  );
}

export function HomepageTickerClient() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const { data, state, retry } = useHomepageData<{ live: Array<{ id: number; name: string; date: string; dateEnd: string | null; level: string; detailItems: TickerItem["detailItems"]; nocCode: string | null; countryCode2: string | null; forceStatus: "LIVE" | "USKORO" | null }>; upcoming: Array<{ id: number; name: string; date: string; level: string; location: string | null; href: string | null }> }>("/api/homepage/ticker", 60_000);

  // Realtime: re-fetch immediately when admin changes ticker overrides
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("ticker-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ticker_live_overrides" }, retry)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_schedule" }, retry)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticker_custom_upcoming" }, retry)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [retry]);
  if (state === "loading") return <div aria-busy="true" className="h-10 animate-pulse bg-[var(--surface)]" />;
  if (state === "error" || !data) return <HomepageError retry={retry} compact />;

  const liveItems: TickerItem[] = data.live.map((item) => ({ id: item.id, name: item.name, date: item.date, endDate: item.dateEnd ?? undefined, level: item.level, status: item.forceStatus ?? "LIVE", detailItems: item.detailItems?.length ? item.detailItems : [{ text: item.forceStatus === "USKORO" ? (item.date) : t("inProgress") }], href: `/takmicenja/${item.id}`, nocCode: item.nocCode ?? undefined, countryCode2: item.countryCode2 ?? undefined }));
  const upcomingItems: TickerItem[] = data.upcoming.map((item) => ({ id: item.id, name: item.name, date: item.date, level: item.level, status: "USKORO", detailText: item.location || common("serbia"), href: item.href ?? undefined }));
  return <Ticker liveItems={liveItems} upcomingItems={upcomingItems} />;
}

export function HomepageMainClient() {
  const locale = useLocale();
  const t = useTranslations("home");
  const tComp = useTranslations("competition");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data, state, retry } = useHomepageData<{ recent: Array<{ id: number; name: string; nameSr: string | null; nameEn: string | null; date: string; location: string | null; level: string; isLive: boolean; discResults: Array<{ discCode: string; isLive: boolean; isJunior: boolean; phases: Array<{ stage: string; isLive: boolean; qualTop3: Array<{ firstName: string; lastName: string; clubName: string | null; nationality: string | null; countryCode2: string | null; qualRank: number | null; qualTotal: number; finalTotal: number | null; finalRank: number | null }>; srbHighlights: Array<{ firstName: string; lastName: string; clubName: string | null; qualRank: number | null; qualTotal: number; finalRank: number | null; finalTotal: number | null }> }> }> }>; upcoming: Array<{ id: number; name: string; nameSr: string | null; nameEn: string | null; date: string; location: string | null; level: string }>; topForma: Record<string, unknown[]> }>("/api/homepage/main");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("live-results-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, retry)
      .on("postgres_changes", { event: "*", schema: "public", table: "mixed_team_results" }, retry)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_schedule" }, retry)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [retry]);

  if (state === "loading") return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
  if (state === "error" || !data) return <HomepageError retry={retry} />;

  const upcoming = data.upcoming.map((item) => ({ ...item, name: locale === "en" ? (item.nameEn ?? item.name) : (item.nameSr ?? item.name) }));
  const [lead, ...recent] = data.recent;

  type Shooter = { firstName: string; lastName: string; clubName: string | null; nationality: string | null; countryCode2: string | null; qualTotal: number; finalTotal: number | null; finalRank: number | null };
  type SrbHighlight = { firstName: string; lastName: string; clubName: string | null; qualRank: number | null; qualTotal: number; finalRank: number | null; finalTotal: number | null };
  type Phase = { stage: string; isLive: boolean; qualTop3: Shooter[]; srbHighlights: SrbHighlight[] };
  type DiscResult = { discCode: string; isLive: boolean; isJunior: boolean; phases: Phase[] };

  function renderDiscResults(discResults: DiscResult[], level: string) {
    if (discResults.length === 0) return <p className="mt-4 text-sm italic text-[var(--muted)]">{t("noWinner")}</p>;
    const isIntl = INTL_LEVELS.has(level.toLowerCase());
    const aff = (e: Shooter) => {
      if (!isIntl && e.clubName) return <span className="shrink-0 hidden sm:block text-[10px] text-[var(--muted)] max-w-[80px] truncate">{e.clubName}</span>;
      if (!e.nationality) return null;
      return (
        <span className="shrink-0 flex items-center gap-0.5">
          {e.countryCode2 && <span className={`fi fi-${e.countryCode2.toLowerCase()}`} style={{ fontSize: 11 }} aria-hidden="true" />}
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] font-bold text-[var(--muted)]">{e.nationality}</span>
        </span>
      );
    };
    // Inline "1. Name 632.2  2. Name 631.8  3. Name …" row. First place reads larger/bold; 2nd-3rd are compact.
    function inlinePlaces(entries: Shooter[], score: (e: Shooter) => number | null, decimals: number, scoreForAllPlaces = true, prefix?: ReactNode, trailing?: ReactNode) {
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {prefix}
          {entries.map((e, i) => {
            const lead = i === 0;
            const value = (scoreForAllPlaces || lead) ? score(e) : null;
            return (
              <span key={i} className="inline-flex items-center gap-1">
                <span className={lead ? "font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold text-[var(--ink)] tabular-nums" : "font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--muted)] tabular-nums"}>
                  {i + 1}.
                </span>
                <span className={lead ? "text-sm font-semibold text-[var(--ink)]" : "text-xs text-[var(--muted)]"}>
                  {e.firstName ? `${e.lastName} ${e.firstName.charAt(0)}.` : e.lastName}
                </span>
                {aff(e)}
                {value != null && (
                  <span className={lead ? "font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold text-[var(--ink)] tabular-nums" : "font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--muted)] tabular-nums"}>
                    {value.toFixed(decimals)}
                  </span>
                )}
              </span>
            );
          })}
          {trailing}
        </div>
      );
    }
    return (
      <div className="mt-3 divide-y divide-[var(--border)]">
        {discResults.map((disc) => {
          const shownPhases = disc.phases.filter((p) => p.qualTop3.length > 0 || p.srbHighlights.length > 0);
          if (shownPhases.length === 0) return null;
          const isAP = disc.discCode.startsWith("AP");
          const discBadge = <span className="shrink-0 inline-block leading-none font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">{disc.discCode}</span>;
          const junBadge = disc.isJunior ? <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: "var(--level-regional-bg)", color: "var(--level-regional-fg)" }}>JUN</span> : null;
          const liveBadge = disc.isLive ? <span className="shrink-0 rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">LIVE</span> : null;
          return (
            <div key={`${disc.discCode}:${disc.isJunior}`} className="py-2 first:pt-0 last:pb-0 flex flex-col gap-1.5">
              {shownPhases.map((phase) => {
                const decimals = phase.stage === "elimination" || isAP || disc.discCode === "SPW" ? 0 : 1;
                const stageBadge = <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">{phase.stage === "elimination" ? "E" : phase.stage === "final" ? "F" : "Q"}</span>;
                return (
                  <div key={phase.stage}>
                    {phase.qualTop3.length > 0 && inlinePlaces(phase.qualTop3, (e) => e.qualTotal, decimals, true, <>{discBadge}{stageBadge}{phase.isLive ? liveBadge : null}{junBadge}</>)}
                    {phase.srbHighlights.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {phase.srbHighlights.map((h, i) => {
                          const isFinalRow = h.finalRank != null && h.finalTotal != null;
                          const rank = isFinalRow ? h.finalRank : h.qualRank;
                          const total = isFinalRow ? h.finalTotal! : h.qualTotal;
                          return (
                            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)]/[0.08] pl-1.5 pr-2 py-0.5">
                              <span className="fi fi-rs shrink-0" style={{ fontSize: 10 }} aria-hidden="true" />
                              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-bold text-[var(--brand-primary)] tabular-nums">
                                {rank != null ? `${rank}.` : "—"}
                              </span>
                              <span className="text-xs font-semibold text-[var(--ink)]">{h.firstName ? `${h.lastName} ${h.firstName.charAt(0)}.` : h.lastName}</span>
                              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold text-[var(--brand-primary)] tabular-nums">{total.toFixed(decimals)}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return <>
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-xl font-bold uppercase tracking-wider">{t("recentCompetitions")}</h2>
        <ScopedLink href="/takmicenja" className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">{t("allCompsLink")}</ScopedLink>
      </div>

      {!lead ? (
        <p className="py-8 text-sm text-[var(--muted)]">{t("noRecentComps")}</p>
      ) : (() => {
        const name = locale === "en" ? (lead.nameEn ?? lead.name) : (lead.nameSr ?? lead.name);
        const levelKey = `levels.${lead.level.toLowerCase()}`;
        const leadLevelLabel = tComp.has(levelKey) ? tComp(levelKey) : lead.level;
        const leadLevelStyle = LEVEL_STYLE[lead.level.toLowerCase()] ?? FALLBACK_LEVEL_STYLE;
        return (
          <ScopedLink
            href={`/takmicenja/${lead.id}`}
            className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--brand-primary)] transition-colors no-underline"
          >
            <div className="flex items-center gap-2 flex-nowrap">
              {lead.isLive && <span className="shrink-0 inline-flex rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">{t("inProgress")}</span>}
              <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded" style={leadLevelStyle}>
                {leadLevelLabel}
              </span>
              <span className="flex-1 min-w-0 truncate text-xs text-[var(--muted)]">
                {lead.date.split("-").reverse().join(".")}{lead.location ? ` · ${lead.location}` : ""}
              </span>
            </div>
            <h3 className="mt-1.5 font-[family-name:var(--font-barlow-condensed)] text-xl sm:text-2xl font-extrabold uppercase leading-tight line-clamp-2 group-hover:text-[var(--brand-primary)] transition-colors">
              {name}
            </h3>
            {renderDiscResults(lead.discResults, lead.level)}
            <p className="mt-4 pt-3 border-t border-[var(--border)] text-sm font-semibold text-[var(--brand-primary)] group-hover:underline">
              {t("viewResults")} →
            </p>
          </ScopedLink>
        );
      })()}

      {recent.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
          {recent.map((item) => {
            const isExpanded = expandedId === item.id;
            const name = locale === "en" ? (item.nameEn ?? item.name) : (item.nameSr ?? item.name);
            const levelKey = `levels.${item.level.toLowerCase()}`;
            const rowLevelLabel = tComp.has(levelKey) ? tComp(levelKey) : item.level;
            const rowLevelStyle = LEVEL_STYLE[item.level.toLowerCase()] ?? FALLBACK_LEVEL_STYLE;
            return (
              <div key={item.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
                >
                  {item.isLive && <span className="inline-flex shrink-0 rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">{t("inProgress")}</span>}
                  <span className="hidden sm:block shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded" style={rowLevelStyle}>
                    {rowLevelLabel}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-[var(--ink)] truncate">
                    {name}
                  </span>
                  <div className="shrink-0 flex items-center gap-2">
                    {item.discResults[0]?.phases[0]?.qualTop3[0] ? (
                      <>
                        <span className="text-xs text-[var(--muted)] hidden sm:block">{item.discResults[0].phases[0].qualTop3[0].lastName}</span>
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold text-[var(--brand-primary)] tabular-nums">
                          {item.discResults[0].phases[0].qualTop3[0].qualTotal.toFixed(item.discResults[0].discCode.startsWith("AP") ? 0 : 1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs italic text-[var(--muted)]">—</span>
                    )}
                  </div>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12"
                    className={`shrink-0 text-[var(--muted)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </button>

                <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                      {renderDiscResults(item.discResults, item.level)}
                      <ScopedLink
                        href={`/takmicenja/${item.id}`}
                        className="mt-4 pt-3 border-t border-[var(--border)] text-sm font-semibold text-[var(--brand-primary)] hover:underline flex no-underline"
                      >
                        {t("viewResults")} →
                      </ScopedLink>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
    <section className="mt-8"><TopFormaClient initialData={data.topForma as never} /></section>
    <section className="mt-8"><UpcomingEvents competitions={upcoming} /></section>
  </>;
}

export function HomepageClubsClient() {
  const t = useTranslations("home");
  const common = useTranslations("common");
  const { data, state, retry } = useHomepageData<Array<{ clubId: number; name: string; city: string | null; avgPercentile: number; activeShooters: number }>>("/api/homepage/clubs");
  if (state === "loading") return <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-[var(--surface)]" />;
  if (state === "error" || !data) return <HomepageError retry={retry} />;
  return <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]"><div className="flex items-baseline justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2"><h3 className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold uppercase text-[var(--ink)]">{t("clubLeaderboard")}</h3><span className="text-xs text-[var(--muted)]">{t("clubLeaderboardMetric")}</span></div><div className="p-4">{data.length === 0 ? <p className="py-4 text-center text-sm text-[var(--muted)]">{t("noClubData")}</p> : data.map((club, index) => <div key={club.clubId} className="flex items-center justify-between py-2 text-sm"><span><b className="mr-3 text-[var(--subtle)]">{index + 1}</b><b>{club.name}</b> <span className="text-[var(--muted)]">{club.city || common("serbia")}</span></span><span className="font-mono font-bold tabular-nums text-[var(--ink)]">{club.avgPercentile.toFixed(1)}%</span></div>)}</div></section>;
}
