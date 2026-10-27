"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { unstable_catchError, type ErrorInfo } from "next/error";
import { NewsSection } from "../components/NewsSection";
import { useParams } from "next/navigation";
import { Ticker } from "../ticker";
import { useTickerData } from "../components/live-ticker-data";
import { createClient } from "@/lib/supabase/client";
import { UpcomingEvents } from "../components/UpcomingEvents";
import { ScopedLink } from "../components/ScopedLink";
import { TopFormaClient } from "./top-forma-client";
import { useHomepageDataStatus } from "./homepage-data-status";
import { LEVEL_STYLE } from "@/lib/competition-utils";
import { MainSkeleton, TickerSkeleton } from "./homepage-skeleton";
import { MIXED_TEAM_CODES } from "@shootermarkt/db/pdf-import-types";
import type { HomepageMainData } from "@/lib/homepage-data";

type ResultPlace = { firstName: string; lastName: string; clubName: string | null; nationality: string | null; countryCode2: string | null; qualRank: number | null; qualTotal: number; finalTotal: number | null; finalRank: number | null; rpo?: boolean };

function InlinePlaces({ entries, score, decimals, prefix, renderAff, reserveToggleSpace = false, collapsed = false, href, toggle }: { entries: ResultPlace[]; score: (entry: ResultPlace) => number | null; decimals: number; prefix?: ReactNode; renderAff: (entry: ResultPlace) => ReactNode; reserveToggleSpace?: boolean; collapsed?: boolean; href: string; toggle?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const allPlacesRef = useRef<HTMLDivElement>(null);
  const firstSecondRef = useRef<HTMLDivElement>(null);
  const secondThirdRef = useRef<HTMLDivElement>(null);
  const [allPlacesFit, setAllPlacesFit] = useState(false);
  const [pairFirstSecond, setPairFirstSecond] = useState(false);

  const place = (entry: ResultPlace, index: number) => {
    const lead = index === 0;
    const value = score(entry);
    return <span key={index} className={`inline-flex items-center gap-1 whitespace-nowrap ${lead ? "min-w-0" : ""}`}>
      <span className={lead ? "shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[13px] sm:text-sm font-bold text-[var(--ink)] tabular-nums" : "shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs sm:text-sm font-semibold text-[var(--muted)] tabular-nums"}>{index + 1}.</span>
      <span className={lead ? "min-w-0 truncate text-[13px] sm:text-sm font-semibold text-[var(--ink)]" : "text-xs sm:text-[13px] text-[var(--muted)]"}>{entry.firstName ? `${entry.lastName} ${entry.firstName.charAt(0)}.` : entry.lastName}{entry.rpo && <span title="RPO" aria-label="RPO">*</span>}</span>
      {renderAff(entry)}
      {value != null && <span className={lead ? "shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[13px] sm:text-sm font-bold text-[var(--ink)] tabular-nums" : "shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs sm:text-sm font-semibold text-[var(--muted)] tabular-nums"}>{value.toFixed(decimals)}</span>}
    </span>;
  };

  useLayoutEffect(() => {
    if (entries.length !== 3) return;
    const measure = () => {
      const row = containerRef.current?.closest<HTMLElement>("[data-phase-row]");
      const full = row?.clientWidth ?? containerRef.current?.clientWidth ?? 0;
      // The toggle sits beside the first row only; later rows may use the full width.
      const firstRowAvailable = full - (reserveToggleSpace ? 44 : 0);
      const allFit = window.matchMedia("(min-width: 1024px)").matches && (allPlacesRef.current?.offsetWidth ?? 0) <= firstRowAvailable;
      const secondThirdFits = (secondThirdRef.current?.offsetWidth ?? 0) <= full;
      const firstSecondFits = (firstSecondRef.current?.offsetWidth ?? 0) <= firstRowAvailable;
      setAllPlacesFit(allFit);
      setPairFirstSecond(!secondThirdFits && firstSecondFits);
    };
    measure();
    const observer = new ResizeObserver(measure);
    const row = containerRef.current?.closest<HTMLElement>("[data-phase-row]");
    if (row) observer.observe(row);
    return () => observer.disconnect();
  }, [entries, reserveToggleSpace]);

  const singleRow = entries.length === 3 && allPlacesFit;
  const useFallback = !singleRow && entries.length === 3 && pairFirstSecond;
  const firstRow = singleRow ? entries : useFallback ? entries.slice(0, 2) : entries.slice(0, 1);
  const secondRow = singleRow ? [] : useFallback ? entries.slice(2) : entries.slice(1);
  return <div ref={containerRef} className="relative overflow-clip">
    <div className="flex items-center">
      <ScopedLink href={href} className="flex min-w-0 flex-nowrap items-center gap-x-2 sm:gap-x-3 no-underline hover:opacity-80 transition-opacity">{prefix}{firstRow.map(place)}</ScopedLink>
      {toggle}
    </div>
    {secondRow.length > 0 && (
      <div className={`grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none ${collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
        <div className={`overflow-hidden ${collapsed ? "[contain:inline-size]" : ""}`}>
          <ScopedLink href={href} tabIndex={collapsed ? -1 : undefined} className={`mt-1 flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 no-underline hover:opacity-80 transition-opacity duration-150 motion-reduce:transition-none ${collapsed ? "opacity-0" : "opacity-100 delay-75"}`}>
            {secondRow.map((entry, index) => place(entry, useFallback ? index + 2 : index + 1))}
          </ScopedLink>
        </div>
      </div>
    )}
    <div className="pointer-events-none absolute invisible whitespace-nowrap" aria-hidden="true">
      <div ref={allPlacesRef} className="flex w-max items-center gap-x-3">{prefix}{entries.map(place)}</div>
      <div ref={firstSecondRef} className="flex w-max items-center gap-x-3">{prefix}{place(entries[0], 0)}{entries[1] && place(entries[1], 1)}</div>
      <div ref={secondThirdRef} className="flex w-max items-center gap-x-3">{entries[1] && place(entries[1], 1)}{entries[2] && place(entries[2], 2)}</div>
    </div>
  </div>;
}

function phaseHref(competitionId: number, discCode: string, stage: string, category: string) {
  const urlStage = stage === "elimination" ? "elim" : stage.startsWith("qual") ? "qual" : stage;
  const params = new URLSearchParams({ disc: discCode, stage: urlStage });
  if ((MIXED_TEAM_CODES as readonly string[]).includes(discCode)) params.set("result", "mixed");
  else params.set("category", category);
  return `/takmicenja/${competitionId}?${params.toString()}`;
}

const DISC_FULL_NAMES: Record<string, { sr: string; en: string }> = {
  ARM: { sr: "Vazdušna puška muški", en: "Air Rifle Men" },
  ARW: { sr: "Vazdušna puška ženski", en: "Air Rifle Women" },
  APM: { sr: "Vazdušni pištolj muški", en: "Air Pistol Men" },
  APW: { sr: "Vazdušni pištolj ženski", en: "Air Pistol Women" },
  ARMT: { sr: "Vazdušna puška mešoviti tim", en: "Air Rifle Mixed Team" },
  APMT: { sr: "Vazdušni pištolj mešoviti tim", en: "Air Pistol Mixed Team" },
  R3PM: { sr: "Puška trostav muški", en: "Rifle 3 Position Men" },
  R3PW: { sr: "Puška trostav ženski", en: "Rifle 3 Position Women" },
  R3JM: { sr: "Puška trostav muški", en: "Rifle 3 Position Men" },
  R3JW: { sr: "Puška trostav ženski", en: "Rifle 3 Position Women" },
  SPW: { sr: "Sport pištolj žene", en: "Sport Pistol Women" },
  RFPM: { sr: "Brzometni pištolj muški", en: "Rapid Fire Pistol Men" },
};

const FALLBACK_LEVEL_STYLE = { background: "var(--level-club-bg)", color: "var(--level-club-fg)" };
const INTL_LEVELS = new Set(["olympic", "world", "continental", "international"]);

function useHomepageData<T>(path: string, refreshMs?: number, initialData?: T) {
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [state, setState] = useState<"loading" | "ready" | "error">(initialData ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);
  const hasData = useRef(initialData != null);
  const autoRetried = useRef<string | null>(null);
  const { clearFailure, reportFailure } = useHomepageDataStatus();
  const retry = useCallback(() => {
    setState("loading");
    setAttempt((value) => value + 1);
  }, []);
  // Osvežavanje u pozadini: sadržaj ostaje na ekranu, pa novi rezultat može da se istakne.
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  // Fetch ide i kad postoji initialData: početna je ISR, pa snimak iz HTML-a može biti star
  // (live rezultati). Snimak se prikaže odmah, a sveži podaci ga zamene u pozadini.
  useEffect(() => {
    const controller = new AbortController();
    clearFailure(path);
    // v = 5-sekundni bucket: svi posetioci dele isti CDN odgovor, a osvežavanje ne dobija 60 s star keš.
    fetch(`${path}?scope=${scope ?? "srb"}&locale=${locale}&v=${Math.floor(Date.now() / 5_000)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Homepage request failed")))
      .then((result) => { hasData.current = true; setData(result); setState("ready"); clearFailure(path); })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!hasData.current) setState("error");
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

  return { data, state, retry, refresh };
}

// Greška pri SSR-u jednog bloka ostaje u tom bloku; ostatak strane (sidebar, ticker) se prikazuje.
export const HomepageBlockBoundary = unstable_catchError(
  ({ silent = false }: { silent?: boolean }, { unstable_retry }: ErrorInfo) => silent ? null : <HomepageError retry={unstable_retry} />,
);

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
  // Dok je takmičenje u toku, traka je u layout-u (sticky header ako je LIVE, inače na vrhu stranice); ovde ostaje samo marquee nadolazećih.
  const { state, liveItems, upcomingItems, retry } = useTickerData();
  if (state === "loading") return <TickerSkeleton />;
  if (state === "error") return <HomepageError retry={retry} compact />;
  if (liveItems.length > 0) return null;
  return <Ticker upcomingItems={upcomingItems} />;
}

type PhaseKeyInput = { stage: string; elimRound?: number | null; category: string };
/** Oznake starosnih kategorija na In focus karticama (en, sr); senior je bez oznake. */
const CATEGORY_BADGE: Record<string, [string, string] | null> = {
  senior: null, open: null,
  junior: ["JUNIOR", "JUNIORI"], mladji_junior: ["U-18", "MLAĐI JUNIORI"], kadet: ["U-16", "KADETI"],
  mladji_senior: ["U-23", "MLAĐI SENIORI"], pionir: ["PIONEER", "PIONIRI"], master: ["MASTER", "MASTERI"],
};

/** Lokacija + oznaka države (zastava i NOC) uz naziv takmičenja. */
function CompetitionPlace({ location, countryCode2, nocCode, className = "", display = false }: { location: string | null; countryCode2: string | null; nocCode: string | null; className?: string; display?: boolean }) {
  if (!location && !countryCode2) return null;
  return (
    <span className={`flex items-center gap-2 text-[var(--ink)] ${display ? "font-[family-name:var(--font-barlow-condensed)] text-base sm:text-xl font-semibold uppercase leading-none" : "text-sm font-semibold"} ${className}`}>
      <span className={`w-0.5 shrink-0 bg-[var(--brand-primary)] ${display ? "h-5" : "h-4"}`} aria-hidden="true" />
      {location && <span className="truncate">{location}</span>}
      {countryCode2 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--bg)] px-1.5 py-0.5 dark:bg-[var(--surface-2)]">
          <span className={`fi fi-${countryCode2.toLowerCase()}`} style={{ fontSize: 11, borderRadius: 2 }} aria-hidden="true" />
          {nocCode && <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-extrabold tracking-wide text-[var(--ink)]">{nocCode}</span>}
        </span>
      )}
    </span>
  );
}

function phaseRowKey(competitionId: number, discCode: string, isJunior: boolean, phase: PhaseKeyInput) {
  return `${competitionId}:${discCode}:${isJunior}:${phase.stage}:${phase.elimRound ?? ""}:${phase.category}`;
}

function LiveBadge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`${className} items-center gap-1`}><span className="live-dot" aria-hidden="true" />{children}</span>;
}

export function HomepageMainClient({ initialData }: { initialData?: HomepageMainData }) {
  const locale = useLocale();
  const t = useTranslations("home");
  const tComp = useTranslations("competition");
  const [isDesktop, setIsDesktop] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedQual, setExpandedQual] = useState<Set<string>>(new Set());
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const toggleQual = (key: string) => setExpandedQual((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const { data, state, retry, refresh } = useHomepageData<HomepageMainData>("/api/homepage/main", undefined, initialData);

  // Fokalni trenutak: kad osvežavanje donese nov ili izmenjen rezultat, taj red se kratko istakne.
  const previousSignatures = useRef<Map<string, string> | null>(null);
  const [flashKeys, setFlashKeys] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const next = new Map<string, string>();
    for (const competition of [...data.recent]) {
      for (const disc of competition.discResults) {
        for (const phase of disc.phases) {
          const signature = [...phase.qualTop3.map((e) => `${e.lastName}:${e.qualTotal}:${e.finalTotal ?? ""}`), ...phase.srbHighlights.map((e) => `${e.lastName}:${e.qualTotal}:${e.finalTotal ?? ""}`)].join("|");
          next.set(phaseRowKey(competition.id, disc.discCode, disc.isJunior, phase), signature);
        }
      }
    }
    const previous = previousSignatures.current;
    previousSignatures.current = next;
    if (!previous) return;
    const changed = new Set<string>();
    next.forEach((signature, key) => { if (signature && previous.get(key) !== signature) changed.add(key); });
    if (changed.size === 0) return;
    setFlashKeys(changed);
    const timeout = window.setTimeout(() => setFlashKeys(new Set()), 1_000);
    return () => window.clearTimeout(timeout);
  }, [data]);

  // Realtime samo dok je neko takmičenje u toku: svaka pretplata drži Supabase Realtime da čita WAL,
  // a van takmičenja se rezultati ne menjaju uživo.
  const hasLive = data?.recent.some((competition) => competition.isLive) ?? false;
  useEffect(() => {
    if (!hasLive) return;
    // Import upisuje mnogo redova odjednom — spoji događaje u jedno osvežavanje.
    let timer: number | undefined;
    const debouncedRefresh = () => { window.clearTimeout(timer); timer = window.setTimeout(refresh, 1_500); };
    const supabase = createClient();
    const channel = supabase
      .channel("live-results-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, debouncedRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "mixed_team_results" }, debouncedRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "competition_schedule" }, debouncedRefresh)
      .subscribe();
    return () => { window.clearTimeout(timer); supabase.removeChannel(channel); };
  }, [hasLive, refresh]);

  if (state === "loading") return <MainSkeleton />;
  if (state === "error" || !data) return <HomepageError retry={retry} />;

  const upcoming = data.upcoming.map((item) => ({ ...item, name: locale === "en" ? (item.nameEn ?? item.name) : (item.nameSr ?? item.name) }));
  const [lead, ...recent] = data.recent;
  const formatCompetitionDate = (date: string, dateEnd: string | null) => {
    const [year, month, day] = date.split("-");
    if (!dateEnd || dateEnd === date) return `${day}.${month}.${year}.`;
    const [endYear, endMonth, endDay] = dateEnd.split("-");
    if (year === endYear && month === endMonth) return `${day}.-${endDay}.${month}.${year}.`;
    if (year === endYear) return `${day}.${month}.-${endDay}.${endMonth}.${year}.`;
    return `${day}.${month}.${year}.-${endDay}.${endMonth}.${endYear}.`;
  };

  type Shooter = { firstName: string; lastName: string; clubName: string | null; nationality: string | null; countryCode2: string | null; qualRank: number | null; qualTotal: number; finalTotal: number | null; finalRank: number | null; rpo?: boolean };
  type SrbHighlight = { firstName: string; lastName: string; clubName: string | null; qualRank: number | null; qualTotal: number; finalRank: number | null; finalTotal: number | null };
  type Phase = { stage: string; elimRound?: number | null; category: string; isLive: boolean; qualTop3: Shooter[]; srbHighlights: SrbHighlight[] };
  type DiscResult = { discCode: string; isLive: boolean; isJunior: boolean; category: string; phases: Phase[] };

  function renderDiscResults(discResults: DiscResult[], level: string, competitionId: number) {
    if (discResults.length === 0) return <p className="mt-4 text-sm italic text-[var(--muted)]">{t("noWinner")}</p>;
    const isIntl = INTL_LEVELS.has(level.toLowerCase());
    const aff = (e: Shooter) => {
      if (!isIntl && e.clubName) return <span className="shrink-0 hidden sm:block text-xs text-[var(--muted)] max-w-[88px] truncate">{e.clubName}</span>;
      if (!e.nationality) return null;
      return (
        <span className="shrink-0 flex items-center gap-0.5">
          {e.countryCode2 && <span className={`fi fi-${e.countryCode2.toLowerCase()}`} style={{ fontSize: 11 }} aria-hidden="true" />}
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] sm:text-xs font-bold text-[var(--muted)]">{e.nationality}</span>
        </span>
      );
    };
    return (
      <div className="mt-3 divide-y divide-[var(--border)]">
        {discResults.map((disc) => {
          const shownPhases = disc.phases
            .filter((p) => p.qualTop3.length > 0 || p.srbHighlights.length > 0 || p.isLive)
            .toSorted((a, b) => Number(b.stage === "final") - Number(a.stage === "final"));
          if (shownPhases.length === 0) return null;
          const isAP = disc.discCode.startsWith("AP");
          const discBadge = <span className="shrink-0 inline-block leading-none font-[family-name:var(--font-barlow-condensed)] text-[15px] font-bold uppercase tracking-[0.04em] text-[var(--muted)]">{DISC_FULL_NAMES[disc.discCode]?.[locale === "en" ? "en" : "sr"] ?? disc.discCode}</span>;
          const categoryLabel = CATEGORY_BADGE[disc.category]?.[locale === "en" ? 0 : 1] ?? null;
          const junBadge = categoryLabel ? <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: "var(--level-regional-bg)", color: "var(--level-regional-fg)" }}>{categoryLabel}</span> : null;
          const liveBadge = disc.isLive ? <LiveBadge className="inline-flex shrink-0 rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">LIVE</LiveBadge> : null;
          return (
            <div key={`${disc.discCode}:${disc.category}`} className="py-2 first:pt-0 last:pb-0 flex flex-col gap-1.5">
              {/* Naziv discipline vodi na prvu prikazanu fazu (finale ako postoji, inače kvalifikacije). */}
              <ScopedLink href={phaseHref(competitionId, disc.discCode, shownPhases[0].stage, shownPhases[0].category)} className="flex w-fit items-center gap-1 no-underline hover:opacity-80 transition-opacity">{discBadge}{junBadge}</ScopedLink>
              {shownPhases.map((phase) => {
                const decimals = phase.stage === "elimination" || (isAP && phase.stage !== "final") || disc.discCode === "SPW" || (disc.discCode.startsWith("R3") && phase.stage !== "final") ? 0 : 1;
                const stageBadge = <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-bold px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">{phase.stage === "elimination" ? `E${phase.elimRound ?? ""}` : phase.stage === "final" ? "F" : "Q"}</span>;
                const hasFinal = shownPhases.some((item) => item.stage === "final");
                const qualKey = `${competitionId}:${disc.discCode}:${phase.category}:qual`;
                const qualExpanded = expandedQual.has(qualKey);
                const extraQualificationResults = phase.qualTop3.length - 1;
                const isCollapsibleQual = !isDesktop && phase.stage.startsWith("qual") && hasFinal && phase.qualTop3.length > 1;
                const qualToggle = isCollapsibleQual ? (
                  <button
                    type="button"
                    onClick={() => toggleQual(qualKey)}
                    aria-expanded={qualExpanded}
                    aria-label={qualExpanded ? t("showLessQualificationResults") : t("showMoreQualificationResults", { count: extraQualificationResults })}
                    className="-my-3 flex min-h-11 shrink-0 items-center px-2 text-[11px] font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    <span className="flex items-center gap-0.5 leading-none">
                    <span>{qualExpanded ? t("showLess") : `+${extraQualificationResults}`}</span>
                    <svg
                      width="8" height="8" viewBox="0 0 12 12"
                      className={`shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${qualExpanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                    </span>
                  </button>
                ) : null;
                // Faza u toku bez ijednog rezultata u bazi: samo oznaka da je počela.
                if (phase.qualTop3.length === 0 && phase.srbHighlights.length === 0) {
                  return (
                    <div key={`${phase.stage}:${phase.elimRound ?? ""}`} className={flashKeys.has(phaseRowKey(competitionId, disc.discCode, disc.isJunior, phase)) ? "w-full live-flash" : "w-full"} data-phase-row>
                      <ScopedLink href={phaseHref(competitionId, disc.discCode, phase.stage, phase.category)} className="flex w-fit items-center gap-1.5 no-underline hover:opacity-80 transition-opacity">
                        {stageBadge}{liveBadge}
                        <span className="text-xs italic text-[var(--muted)]">{t("liveResultsSoon")}</span>
                      </ScopedLink>
                    </div>
                  );
                }
                return (
                  <div key={`${phase.stage}:${phase.elimRound ?? ""}`} className={flashKeys.has(phaseRowKey(competitionId, disc.discCode, disc.isJunior, phase)) ? "w-full live-flash" : "w-full"} data-phase-row>
                    <div className="min-w-0 w-fit max-w-full">
                      {phase.qualTop3.length > 0 && <InlinePlaces href={phaseHref(competitionId, disc.discCode, phase.stage, phase.category)} toggle={qualToggle} entries={phase.qualTop3} score={(entry) => entry.qualTotal} decimals={decimals} prefix={<>{stageBadge}{phase.isLive ? liveBadge : null}</>} renderAff={aff} reserveToggleSpace={qualToggle != null} collapsed={isCollapsibleQual && !qualExpanded} />}
                    </div>
                    {phase.srbHighlights.length > 0 && (
                      <ScopedLink href={phaseHref(competitionId, disc.discCode, phase.stage, phase.category)} className="block no-underline hover:opacity-80 transition-opacity">
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {phase.srbHighlights.map((h, i) => {
                            const isFinalRow = h.finalRank != null && h.finalTotal != null;
                            const rank = isFinalRow ? h.finalRank : h.qualRank;
                            const total = isFinalRow ? h.finalTotal! : h.qualTotal;
                            return (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)]/[0.08] pl-1.5 pr-2 py-0.5">
                                <span className="fi fi-rs shrink-0" style={{ fontSize: 10 }} aria-hidden="true" />
                                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-bold text-[var(--brand-primary)] tabular-nums">
                                  {rank != null ? `${rank}.` : "—"}
                                </span>
                                <span className="text-xs font-semibold text-[var(--ink)]">{h.firstName ? `${h.lastName} ${h.firstName.charAt(0)}.` : h.lastName}</span>
                                <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-bold text-[var(--brand-primary)] tabular-nums">{total.toFixed(decimals)}</span>
                              </span>
                            );
                          })}
                        </div>
                      </ScopedLink>
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
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-2xl sm:text-3xl font-bold uppercase leading-none tracking-wider">{t("recentCompetitions")}</h2>
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
          <div className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-4 hover:border-[var(--brand-primary)] transition-colors">
            <ScopedLink href={`/takmicenja/${lead.id}`} className="block no-underline">
              <div className="flex items-center gap-2 flex-nowrap">
                {lead.isLive && <span className="shrink-0 inline-flex rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">{t("inProgress")}</span>}
                <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded" style={leadLevelStyle}>
                  {leadLevelLabel}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[var(--muted)]">
                  {formatCompetitionDate(lead.date, lead.dateEnd)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-[family-name:var(--font-barlow-condensed)] text-xl sm:text-2xl font-extrabold uppercase leading-tight line-clamp-2 group-hover:text-[var(--brand-primary)] transition-colors">
                  {name}
                </h3>
                <CompetitionPlace location={lead.location} countryCode2={lead.countryCode2} nocCode={lead.nocCode} display />
              </div>
            </ScopedLink>
            {renderDiscResults(lead.discResults, lead.level, lead.id)}
            <ScopedLink href={`/takmicenja/${lead.id}`} className="mt-4 pt-3 border-t border-[var(--border)] text-sm font-semibold text-[var(--brand-primary)] hover:underline flex no-underline">
              {t("viewResults")} →
            </ScopedLink>
          </div>
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
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] active:scale-[0.995] motion-reduce:active:scale-100 transition-[background-color,transform] duration-150 ease-[var(--ease-out)]"
                >
                  {item.isLive && <span className="inline-flex shrink-0 rounded bg-[var(--brand-primary)] px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">{t("inProgress")}</span>}
                  <span className="hidden sm:block shrink-0 text-[11px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded" style={rowLevelStyle}>
                    {rowLevelLabel}
                  </span>
                  {/* Mobilni: naziv u prvom redu, mesto + datum u drugom; sm+: sve u jednom redu. */}
                  <span className="flex flex-1 min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="min-w-0 text-sm font-semibold text-[var(--ink)] truncate">
                      {name}
                    </span>
                    <span className="flex min-w-0 items-center gap-3 sm:contents">
                      <CompetitionPlace location={item.location} countryCode2={item.countryCode2} nocCode={item.nocCode} className="min-w-0 shrink sm:max-w-[16rem]" />
                      <span className="ml-auto shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-[var(--muted)]">{formatCompetitionDate(item.date, item.dateEnd)}</span>
                    </span>
                  </span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12"
                    className={`shrink-0 text-[var(--muted)] transition-transform duration-200 ease-[var(--ease-out)] motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </button>

                <div className={`grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4">
                      {renderDiscResults(item.discResults, item.level, item.id)}
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
    <section className="mt-8"><NewsSection /></section>
    <section className="mt-8"><UpcomingEvents competitions={upcoming} /></section>
  </>;
}

