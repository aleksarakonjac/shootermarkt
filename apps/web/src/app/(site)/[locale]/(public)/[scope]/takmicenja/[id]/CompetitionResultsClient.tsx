"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { QualDetail, FinalDetail, ElimDetail, AgeCategory } from "@shootermarkt/db/schema";
import { CATEGORY_LABEL, type RemarkDetails } from "@shootermarkt/db/pdf-import-types";
import {
  CompetitionQualTable,
  type CompResultRow,
} from "@/components/result-display/CompetitionQualTable";
import {
  CompetitionFinalTable,
  type FinalResultRow,
} from "@/components/result-display/CompetitionFinalTable";
import {
  MixedTeamQualTable,
  isMatchFormat,
  matchTeams,
  type MixedTeamRow,
} from "@/components/result-display/MixedTeamQualTable";
import { startNavigationProgress, finishNavigationProgress } from "@/components/NavigationProgress";
import { shouldShowFinalMedals, type FinalSlot } from "@/lib/final-medals";
import { normalizeFinalDetailsForDisplay } from "@/lib/final-detail";
import { todayKey } from "./ScheduleSection";

export type DisciplineGroup = {
  /** Jedinstven id bloka (ključ + kategorija kad je disciplina podeljena po mečevima) */
  id: string;
  /** Ključ izbora/URL-a: kod discipline, ili "ARM@12" za zaseban meč (competition_events) */
  key: string;
  code: string;
  name: string;
  /** Naziv zasebnog meča istog takmičenja (npr. memorijal drugog dana); null = glavno takmičenje */
  eventName: string | null;
  /** Oznaka bloka: naziv meča, uz kategoriju kad disciplina ima više mečeva */
  label: string | null;
  /** Datum meča (ISO "2026-01-22"), kad je poznat (event ili raspored) */
  date: string | null;
  apparatus: string | null;
  categories: Array<{
    category: AgeCategory;
    results: Array<{
      id: number;
      shooterId: number;
      firstName: string;
      lastName: string;
      birthYear: number | null;
      nationality: string | null;
      avatarUrl: string | null;
      clubName: string | null;
      clubNocCode: string | null;
      elimRound: number | null;
      elimTotal: number | null;
      elimRank: number | null;
      elimDetail: ElimDetail | null;
      elimRemark: string | null;
      qualTotal: string | null;
      qualRank: number | null;
      qualInners: number | null;
      qualified: boolean | null;
      qualDetail: QualDetail | null;
      qualRemark: string | null;
      finalTotal: string | null;
      finalRank: number | null;
      finalDetail: FinalDetail | null;
      finalRemark: string | null;
      remarkDetails: RemarkDetails | null;
    }>;
  }>;
};

export type MixedTeamGroup = {
  code: string;
  category: AgeCategory;
  name: string;
  apparatus: string | null;
  /** Datum kvalifikacija iz rasporeda (ISO), kad postoji */
  date: string | null;
  teams: MixedTeamRow[];
};

type Stage = "elim" | "qual" | "final" | "gold" | "bronze";

const MATCH_LABELS: Record<string, Record<"gold" | "bronze", string>> = {
  sr: { gold: "Zlatni meč", bronze: "Bronzani meč" },
  en: { gold: "Gold Medal Match", bronze: "Bronze Medal Match" },
};

/** Mešoviti timovi: jedno finale, ili (do 2025) zasebni zlatni i bronzani meč. */
function mixedFinalStages(teams: MixedTeamRow[]): Array<"final" | "gold" | "bronze"> {
  if (!teams.some((t) => t.finalRank != null || t.finalTotal != null)) return [];
  if (!isMatchFormat(teams)) return ["final"];
  return (["gold", "bronze"] as const).filter((medal) => matchTeams(teams, medal).length > 0);
}

type Selection =
  | { kind: "individual"; disciplineCode: string; category: AgeCategory; stage: Stage; elimRound?: number }
  | { kind: "mixed"; disciplineCode: string; category: AgeCategory; stage: Stage; elimRound?: number };

interface Props {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
  competitionId: number;
  locale: string;
  competitionLevel?: string;
  /** Satnica finala (disciplina + kategorija) — medalje se prikazuju tek kad je finale gotovo. */
  finalSlots?: Array<FinalSlot & { disciplineCode: string; category: string }>;
}

// ── Fade variants ─────────────────────────────────────────────────────────────

const fadeVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
  exit:   { opacity: 0, y: -4, transition: { duration: 0.12, ease: "easeIn" as const } },
};

// ── Discipline names ──────────────────────────────────────────────────────────

const DISCIPLINE_NAMES: Record<string, { sr: string; en: string }> = {
  ARM:  { sr: "Vazdušna puška M",    en: "Air rifle M" },
  ARW:  { sr: "Vazdušna puška Ž",    en: "Air rifle W" },
  APM:  { sr: "Vazdušni pištolj M",  en: "Air pistol M" },
  APW:  { sr: "Vazdušni pištolj Ž",  en: "Air pistol W" },
  R3PM: { sr: "3×20 puška M",        en: "3×20 rifle M" },
  R3PW: { sr: "3×20 puška Ž",        en: "3×20 rifle W" },
  APMT: { sr: "10m pištolj miks",    en: "Air Pistol Mixed Team" },
  ARMT: { sr: "10m puška miks",      en: "Air Rifle Mixed Team" },
  SPW:  { sr: "Sport pištolj Ž",     en: "Sport pistol W" },
  RFPM: { sr: "Brza vatra M",        en: "Rapid fire M" },
  R3JM: { sr: "3×20 puška jr. M",    en: "3×20 rifle jr. M" },
  R3JW: { sr: "3×20 puška jr. Ž",    en: "3×20 rifle jr. W" },
};

// Keep the overview readable as a program, not as the order rows happened to
// arrive from separate individual and mixed-result queries.
const DISCIPLINE_ORDER = ["ARM", "ARW", "ARMT", "R3PM", "R3PW", "R3JM", "R3JW", "APM", "APW", "APMT", "SPW", "RFPM", "FPM"];
function disciplineOrder(code: string) {
  const index = DISCIPLINE_ORDER.indexOf(code);
  return index === -1 ? DISCIPLINE_ORDER.length : index;
}

// Pregled se deli po danu kad svaka pojedinačna disciplina ima datum, inače po grupi disciplina
// (oružje + vazdušno/MK), da muški, ženski i miks iste discipline stoje zajedno.
type Family = "airRifle" | "rifle" | "airPistol" | "pistol";
const FAMILY_ORDER: Family[] = ["airRifle", "rifle", "airPistol", "pistol"];
const FAMILY_LABELS: Record<string, Record<Family, string>> = {
  sr: { airRifle: "Vazdušna puška", rifle: "MK puška", airPistol: "Vazdušni pištolj", pistol: "MK pištolj" },
  en: { airRifle: "Air rifle", rifle: "Rifle", airPistol: "Air pistol", pistol: "Pistol" },
};
function disciplineFamily(code: string): Family {
  return code.startsWith("AR") ? "airRifle" : code.startsWith("AP") ? "airPistol" : code.startsWith("R3") ? "rifle" : "pistol";
}
const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
function weekday(iso: string, locale: string, format: "long" | "short" = "long"): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale === "sr" ? "sr-Latn-RS" : "en-GB", { weekday: format });
}

function disciplineName(code: string, locale: string): string {
  const entry = DISCIPLINE_NAMES[code];
  if (!entry) return code;
  return locale === "en" ? entry.en : entry.sr;
}

// ── Phase labels ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, Record<string, string>> = {
  sr: { elim: "Eliminacije", qual: "Kvalifikacije", final: "Finale" },
  en: { elim: "Elimination", qual: "Qualification", final: "Final" },
};

function eliminationRoundLabel(round: number, locale: string): string {
  return `${(PHASE_LABELS[locale] ?? PHASE_LABELS.en).elim} — relay ${round}`;
}

// ── Root ──────────────────────────────────────────────────────────────────────

// useSearchParams na ISR stranici traži Suspense. Fallback je isti prikaz bez izbora iz URL-a,
// pa tabela ostaje u statičkom HTML-u; izbor iz URL-a se primeni posle hidratacije.
export function CompetitionResultsClient(props: Props) {
  return (
    <Suspense fallback={<CompetitionResultsView {...props} search="" />}>
      <CompetitionResultsWithSearch {...props} />
    </Suspense>
  );
}

function CompetitionResultsWithSearch(props: Props) {
  return <CompetitionResultsView {...props} search={useSearchParams().toString()} />;
}

function CompetitionResultsView({ groups, mixedGroups, competitionId, locale, competitionLevel, finalSlots = [], search }: Props & { search: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const detailRef = useRef<HTMLDivElement>(null);
  // Overview se unmount-uje dok je disciplina otvorena; pamtimo scroll da ga vratimo na izlazu.
  const overviewScroll = useRef<number | null>(null);

  const urlSelection = useMemo<Selection | null>(() => {
    const params = new URLSearchParams(search);
    const disciplineCode = params.get("disc");
    const stage = params.get("stage");
    if (!disciplineCode || (stage !== "elim" && stage !== "qual" && stage !== "final" && stage !== "gold" && stage !== "bronze")) return null;

    const round = Number(params.get("round"));
    const elimRound = stage === "elim" && Number.isInteger(round) && round > 0 ? round : undefined;

    const category = params.get("category") as AgeCategory | null;
    if (params.get("result") === "mixed") {
      // Linkovi bez kategorije (stariji) vode na senior.
      const mixedCategory = category ?? "senior";
      return mixedGroups.some((group) => group.code === disciplineCode && group.category === mixedCategory)
        ? { kind: "mixed", disciplineCode, category: mixedCategory, stage, elimRound }
        : null;
    }

    return category && groups.some((group) => group.key === disciplineCode && group.categories.some((item) => item.category === category))
      ? { kind: "individual", disciplineCode, category, stage, elimRound }
      : null;
  }, [groups, mixedGroups, search]);
  const [selection, setSelection] = useState<Selection | null>(() => urlSelection);

  useEffect(() => {
    // Browser Back/Forward changes the URL outside of this component's click handlers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection(urlSelection);
  }, [urlSelection]);

  const setSelectionUrl = useCallback((next: Selection | null, replace = false) => {
    const params = new URLSearchParams(search);
    ["result", "disc", "category", "stage", "round"].forEach((key) => params.delete(key));

    if (next) {
      params.set("result", next.kind);
      params.set("disc", next.disciplineCode);
      params.set("stage", next.stage);
      params.set("category", next.category);
      if (next.stage === "elim" && next.elimRound != null) params.set("round", String(next.elimRound));
    }

    const href = params.size > 0 ? `${pathname}?${params}` : pathname;
    // Samo URL: Next 16 sinhronizuje native history sa useSearchParams, a server se ne zove
    // (stranica je ISR i ne čita searchParams), pa nema čekanja ni pomeranja stranice.
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }, [pathname, search]);

  // Live osvežavanje podataka radi u pozadini (transition ne blokira UI); samo gornja traka pokazuje da traje.
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => {
    if (refreshing) startNavigationProgress();
    else finishNavigationProgress();
  }, [refreshing]);
  const refreshTimer = useRef<number | null>(null);
  const retry = useCallback(() => {
    // Import upisuje mnogo redova odjednom — spoji događaje u jedno osvežavanje.
    if (refreshTimer.current != null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => startRefresh(() => router.refresh()), 800);
  }, [router]);
  useEffect(() => () => { if (refreshTimer.current != null) window.clearTimeout(refreshTimer.current); }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-results-comp-${competitionId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "results",
        filter: `competition_id=eq.${competitionId}`,
      }, retry)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [competitionId, retry]);

  if (groups.length === 0 && mixedGroups.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
        <p className="mx-auto text-sm font-medium text-[var(--muted)]">
          {locale === "en" ? "No results entered for this competition." : "Nema unetih rezultata za ovo takmičenje."}
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selection === null ? (
        <motion.div key="overview" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onAnimationStart={(def) => {
          if (def !== "visible" || overviewScroll.current == null) return;
          window.scrollTo({ top: overviewScroll.current, behavior: "instant" });
          overviewScroll.current = null;
        }}>
          <CompetitionOverview
            groups={groups}
            mixedGroups={mixedGroups}
            locale={locale}
            onSelectIndividual={(code, category, stage, elimRound) => {
              const next = { kind: "individual" as const, disciplineCode: code, category, stage, elimRound };
              overviewScroll.current = window.scrollY;
              setSelection(next);
              setSelectionUrl(next);
            }}
            onSelectMixed={(code, category, stage) => {
              const next = { kind: "mixed" as const, disciplineCode: code, category, stage };
              overviewScroll.current = window.scrollY;
              setSelection(next);
              setSelectionUrl(next);
            }}
          />
        </motion.div>
      ) : (
        <motion.div ref={detailRef} key="detail" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="scroll-mt-24" onAnimationStart={(def) => { if (def === "visible") detailRef.current?.scrollIntoView({ block: "start" }); }}>
          <CompetitionDetail
            groups={groups}
            mixedGroups={mixedGroups}
            selection={selection}
            locale={locale}
            competitionLevel={competitionLevel}
            finalSlots={finalSlots}
            onBack={() => {
              setSelection(null);
              setSelectionUrl(null, true);
            }}
            onStageChange={(stage, elimRound) => {
              const next = { ...selection, stage: stage as Stage, elimRound };
              setSelection(next);
              setSelectionUrl(next, true);
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function CompetitionOverview({
  groups,
  mixedGroups,
  locale,
  onSelectIndividual,
  onSelectMixed,
}: {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
  locale: string;
  onSelectIndividual: (code: string, category: AgeCategory, stage: Stage, elimRound?: number) => void;
  onSelectMixed: (code: string, category: AgeCategory, stage: "qual" | "final" | "gold" | "bronze") => void;
}) {
  const byDay = groups.length > 0 && groups.every((g) => g.date);
  const reduceMotion = useReducedMotion();
  // Lokalni "danas" tek posle hidratacije (server ne zna vremensku zonu posetioca)
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayKey()), []);
  // Današnji chip centriran u redu prečica (samo vodoravno, stranica se ne pomera)
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const chip = today && nav?.querySelector<HTMLElement>(`a[href="#sekcija-${today}"]`);
    if (!nav || !chip) return;
    const navRect = nav.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    nav.scrollLeft += chipRect.left - navRect.left - (navRect.width - chipRect.width) / 2;
  }, [today]);
  const todayLabel = locale === "en" ? "Today" : "Danas";
  const items: Array<{ key: string; code: string; date: string | null; node: React.ReactNode }> = [
      // Individual disciplines
      ...groups.map((g) => {
        const totalShooters = g.categories.reduce((count, category) => {
          const eliminationRows = category.results.filter((result) => result.elimRound != null);
          return count + (eliminationRows.length > 0
            ? eliminationRows.length
            : category.results.filter((result) => result.qualTotal != null).length);
        }, 0);
        const singleCat = g.categories.length === 1;
        const singleCatData = singleCat ? g.categories[0] : null;

        return { key: g.id, code: g.code, date: g.date, node: (
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded"
                style={{ background: "var(--brand-primary)", color: "#fff", letterSpacing: "0.06em" }}
              >
                {g.code}
              </span>
              <span className="text-sm font-semibold text-[var(--ink)]">{disciplineName(g.code, locale)}</span>
              {g.label && <span className="text-xs font-semibold text-[var(--brand-primary)] truncate">{g.label}</span>}
              {g.date && !byDay && <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)]">{ddmm(g.date)}</span>}
              <span className="text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] ml-auto">
                {totalShooters} {locale === "en" ? "athletes" : "strelaca"}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
              {singleCat && singleCatData ? (
                /* Single category: show phase rows directly */
                <SingleCatRows
                  catData={singleCatData}
                  locale={locale}
                  onSelect={(stage, elimRound) => onSelectIndividual(g.key, singleCatData.category, stage, elimRound)}
                />
              ) : (
                /* Multiple categories: category rows */
                g.categories.map((cat) => {
                  const hasFinal = cat.results.some((r) => r.finalRank != null || r.finalTotal != null);
                  const hasElim = cat.results.some((r) => r.elimRound != null);
                  const hasQual = cat.results.some((r) => r.qualTotal != null);
                  return (
                    <button
                      key={cat.category}
                      onClick={() => onSelectIndividual(g.key, cat.category, hasQual ? "qual" : "elim")}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm font-semibold text-[var(--ink)] truncate">
                          {CATEGORY_LABEL[cat.category]}
                        </span>
                        <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)] leading-none self-center translate-y-px">
                          {cat.results.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasElim && <PhaseBadge label="E" elim />}
                        {hasQual && <PhaseBadge label="Q" active />}
                        {hasFinal && <PhaseBadge label="F" accent />}
                        <ChevronRight size={14} className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150 ml-0.5" aria-hidden="true" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) };
      }),

      // Mixed team disciplines
      ...mixedGroups.map((g) => ({ key: `${g.code}|${g.category}`, code: g.code, date: g.date, node: (
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded"
              style={{ background: "var(--brand-primary)", color: "#fff", letterSpacing: "0.06em" }}
            >
              {g.code}
            </span>
            <span className="text-sm font-semibold text-[var(--ink)]">{disciplineName(g.code, locale)}{g.category !== "senior" && ` · ${CATEGORY_LABEL[g.category]}`}</span>
            <span className="text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] ml-auto">
              {g.teams.length} {locale === "en" ? "teams" : "timova"}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            <button
              onClick={() => onSelectMixed(g.code, g.category, "qual")}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PhaseBadge label="Q" active />
                <span className="text-sm font-semibold text-[var(--ink)]">{(PHASE_LABELS[locale] ?? PHASE_LABELS.en).qual}</span>
                <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)] leading-none self-center translate-y-px">
                  {g.teams.length}
                </span>
              </div>
              <ChevronRight size={14} className="shrink-0 text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150" aria-hidden="true" />
            </button>
            {mixedFinalStages(g.teams).map((stage) => <button key={stage} onClick={() => onSelectMixed(g.code, g.category, stage)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"><div className="flex items-center gap-2.5 min-w-0"><PhaseBadge label={stage === "final" ? "F" : stage === "gold" ? "G" : "B"} accent /><span className="text-sm font-semibold text-[var(--ink)]">{stage === "final" ? (PHASE_LABELS[locale] ?? PHASE_LABELS.en).final : (MATCH_LABELS[locale] ?? MATCH_LABELS.en)[stage]}</span><span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)] leading-none self-center translate-y-px">{stage === "final" ? g.teams.filter((t) => t.finalRank != null || t.finalTotal != null).length : matchTeams(g.teams, stage).length}</span></div><ChevronRight size={14} className="shrink-0 text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150" aria-hidden="true" /></button>)}
          </div>
        </div>
      ) })),
  ];

  // Sekcija: dan (kad je pregled po danima i stavka ima datum), inače grupa disciplina. Unutar sekcije po kodu discipline.
  const sectionOf = (item: (typeof items)[number]) => (byDay && item.date ? item.date : disciplineFamily(item.code));
  // dani (ISO) hronološki, pa grupe disciplina; "~" je u ASCII posle cifara
  const sectionRank = (key: string) => (/^\d/.test(key) ? key : `~${FAMILY_ORDER.indexOf(key as Family)}`);
  const sections = [...new Set(items.map(sectionOf))].sort((a, b) => (sectionRank(a) < sectionRank(b) ? -1 : 1));
  const familyLabels = FAMILY_LABELS[locale] ?? FAMILY_LABELS.en;

  const isDaySection = (section: string) => /^\d/.test(section);

  return (
    <div className="flex flex-col gap-10">
      {sections.length > 1 && (
        // Prečice do sekcija: sidra (rade i bez JS-a), skrol bez menjanja URL-a
        <nav
          ref={navRef}
          aria-label={locale === "en" ? "Jump to section" : "Skok na sekciju"}
          className="-mb-4 flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 [scrollbar-width:none]"
        >
          {sections.map((section) => (
            <a
              key={section}
              href={`#sekcija-${section}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`sekcija-${section}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)]"
            >
              {isDaySection(section) ? (
                <>
                  {section === today ? <span className="text-[var(--brand-primary)]">{todayLabel}</span> : weekday(section, locale, "short")}
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-medium normal-case tracking-normal text-[var(--subtle)]">{ddmm(section)}</span>
                </>
              ) : (
                familyLabels[section as Family]
              )}
            </a>
          ))}
        </nav>
      )}
      {sections.map((section) => {
        const sectionItems = items
          .filter((item) => sectionOf(item) === section)
          .sort((a, b) => disciplineOrder(a.code) - disciplineOrder(b.code));
        const isDay = /^\d/.test(section);
        return (
          <section key={section} id={`sekcija-${section}`} className="flex scroll-mt-24 flex-col gap-5" aria-label={isDay ? `${weekday(section, locale)} ${ddmm(section)}` : familyLabels[section as Family]}>
            {sections.length > 1 && (
              <h3 className="flex items-center gap-3 font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[var(--ink)] text-lg leading-none tracking-[-0.01em]">
                {isDay ? (
                  <>
                    <span className={section === today ? "text-[var(--brand-primary)]" : undefined}>{section === today ? todayLabel : weekday(section, locale)}</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.75rem] font-medium text-[var(--muted)] translate-y-px">{ddmm(section)}</span>
                  </>
                ) : (
                  <span>{familyLabels[section as Family]}</span>
                )}
                <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
              </h3>
            )}
            {sectionItems.map((item) => <div key={item.key}>{item.node}</div>)}
          </section>
        );
      })}
    </div>
  );
}

// ── Single-category phase rows ────────────────────────────────────────────────

function SingleCatRows({
  catData,
  locale,
  onSelect,
}: {
  catData: DisciplineGroup["categories"][number];
  locale: string;
  onSelect: (stage: Stage, elimRound?: number) => void;
}) {
  const hasElim = catData.results.some((r) => r.elimRound != null);
  const hasQual = catData.results.some((r) => r.qualTotal != null);
  const hasFinal = catData.results.some((r) => r.finalRank != null || r.finalTotal != null);

  // Collect distinct elim rounds sorted
  const elimRounds = hasElim
    ? [...new Set(catData.results.map((r) => r.elimRound).filter((r): r is number => r != null))].sort((a, b) => a - b)
    : [];

  return (
    <>
      {/* Elimination: one row per round */}
      {elimRounds.map((rnd) => {
        const count = catData.results.filter((r) => r.elimRound === rnd).length;
        return (
          <button
            key={`e${rnd}`}
            onClick={() => onSelect("elim", rnd)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <PhaseBadge label="E" elim />
              <span className="text-sm font-semibold text-[var(--ink)] truncate">
                {eliminationRoundLabel(rnd, locale)}
              </span>
              <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)] leading-none self-center translate-y-px">
                {count}
              </span>
            </div>
            <ChevronRight size={14} className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150" aria-hidden="true" />
          </button>
        );
      })}

      {/* Qualification */}
      {hasQual && (
        <button
          onClick={() => onSelect("qual")}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <PhaseBadge label="Q" active />
            <span className="text-sm font-semibold text-[var(--ink)] truncate">
              {(PHASE_LABELS[locale] ?? PHASE_LABELS.en).qual}
            </span>
            <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)] leading-none self-center translate-y-px">
              {catData.results.filter((r) => r.qualTotal != null).length}
            </span>
          </div>
          <ChevronRight size={14} className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150" aria-hidden="true" />
        </button>
      )}

      {/* Final */}
      {hasFinal && (
        <button
          onClick={() => onSelect("final")}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <PhaseBadge label="F" accent />
            <span className="text-sm font-semibold text-[var(--ink)] truncate">
              {(PHASE_LABELS[locale] ?? PHASE_LABELS.en).final}
            </span>
          </div>
          <ChevronRight size={14} className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150" aria-hidden="true" />
        </button>
      )}
    </>
  );
}

// ── Phase badge ───────────────────────────────────────────────────────────────

function PhaseBadge({
  label,
  active = false,
  accent = false,
  elim = false,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
  elim?: boolean;
}) {
  if (elim) {
    return (
      <span
        className="inline-flex w-6 justify-center items-center px-2 py-0.5 rounded text-[0.7rem] font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)]"
        style={{
          background: "color-mix(in oklch, oklch(0.65 0.15 30) 12%, transparent)",
          color: "oklch(0.55 0.15 30)",
          border: "1px solid color-mix(in oklch, oklch(0.65 0.15 30) 25%, transparent)",
        }}
      >
        {label}
      </span>
    );
  }
  if (accent) {
    return (
      <span
        className="inline-flex w-6 justify-center items-center px-2 py-0.5 rounded text-[0.7rem] font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)]"
        style={{
          background: "color-mix(in oklch, var(--brand-accent) 12%, transparent)",
          color: "var(--brand-accent)",
          border: "1px solid color-mix(in oklch, var(--brand-accent) 22%, transparent)",
        }}
      >
        {label}
      </span>
    );
  }
  if (active) {
    return (
      <span
        className="inline-flex w-6 justify-center items-center px-2 py-0.5 rounded text-[0.7rem] font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)]"
        style={{
          background: "color-mix(in oklch, var(--success) 12%, transparent)",
          color: "var(--success)",
          border: "1px solid color-mix(in oklch, var(--success) 22%, transparent)",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex w-6 justify-center items-center px-2 py-0.5 rounded text-[0.7rem] font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)] bg-[var(--surface-2)] text-[var(--subtle)] border border-[var(--border)]">
      {label}
    </span>
  );
}

// ── Detail ────────────────────────────────────────────────────────────────────

function CompetitionDetail({
  groups,
  mixedGroups,
  selection,
  locale,
  competitionLevel,
  finalSlots,
  onBack,
  onStageChange,
}: {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
  selection: Selection;
  locale: string;
  competitionLevel?: string;
  finalSlots: NonNullable<Props["finalSlots"]>;
  onBack: () => void;
  onStageChange: (stage: string, elimRound?: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  // Sat za odluku o medaljama u finalu (finale se završava dok je stranica otvorena).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const selectorTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  if (selection.kind === "mixed") {
    const mixedGroup = mixedGroups.find((g) => g.code === selection.disciplineCode && g.category === selection.category);
    const finalStages = mixedGroup ? mixedFinalStages(mixedGroup.teams) : [];
    const mixedStage = selection.stage;
    const stageTeams = mixedGroup ? (mixedStage === "gold" || mixedStage === "bronze" ? matchTeams(mixedGroup.teams, mixedStage) : mixedGroup.teams) : [];
    const showMixedMedals = shouldShowFinalMedals(finalSlots.find((slot) => slot.disciplineCode === selection.disciplineCode && slot.category === selection.category), [], now);

    return (
      <div>
        <div className="flex items-start gap-3 mb-5">
          <button
            onClick={onBack}
            className="mt-0.5 shrink-0 flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-150"
            aria-label={locale === "en" ? "Back to disciplines" : "Nazad na pregled disciplina"}
          >
            <ChevronLeft size={14} aria-hidden="true" />
            {locale === "en" ? "Back" : "Nazad"}
</button>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span
              className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded shrink-0"
              style={{ background: "var(--brand-primary)", color: "#fff", letterSpacing: "0.06em" }}
            >
              {selection.disciplineCode}
            </span>
            <h3
              className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[var(--ink)] uppercase truncate"
              style={{ fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}
            >
              {mixedGroup ? disciplineName(mixedGroup.code, locale) : ""}{selection.category !== "senior" && ` · ${CATEGORY_LABEL[selection.category]}`}
            </h3>
          </div>
        </div>

        {finalStages.length > 0 && (
          <div className="flex items-center gap-0.5 mb-5 p-1 bg-[var(--surface)] rounded-lg w-fit border border-[var(--border)] max-w-full overflow-x-auto">
            {(["qual", ...finalStages] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStageChange(s)}
                className={`flex shrink-0 items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
                  selection.stage === s ? "bg-[var(--bg)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {s === "qual" ? (
                  <><PhaseBadge label="Q" active={selection.stage === "qual"} />{(PHASE_LABELS[locale] ?? PHASE_LABELS.en).qual}</>
                ) : (
                  <><PhaseBadge label={s === "final" ? "F" : s === "gold" ? "G" : "B"} accent={selection.stage === s} />{s === "final" ? (PHASE_LABELS[locale] ?? PHASE_LABELS.en).final : (MATCH_LABELS[locale] ?? MATCH_LABELS.en)[s]}</>
                )}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selection.stage} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.22 } }} exit={{ opacity: 0, transition: { duration: 0.16 } }}>
            <MixedTeamQualTable teams={stageTeams} apparatus={mixedGroup?.apparatus ?? null} stage={selection.stage === "qual" ? "qual" : "final"} showMedals={showMixedMedals} />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Individual discipline
  const group = groups.find((g) => g.key === selection.disciplineCode && g.categories.some((c) => c.category === selection.category));
  const catGroup = group?.categories.find((c) => c.category === selection.category);
  const showCategory = (group?.categories.length ?? 0) > 1;

  const hasFinal = catGroup?.results.some((r) => r.finalRank != null || r.finalTotal != null) ?? false;
  const hasElim = catGroup?.results.some((r) => r.elimRound != null) ?? false;
  const hasQual = catGroup?.results.some((r) => r.qualTotal != null) ?? false;

  // Distinct elimination rounds sorted
  const elimRounds = hasElim
    ? [...new Set(catGroup!.results.map((r) => r.elimRound).filter((r): r is number => r != null))].sort((a, b) => a - b)
    : [];

  // Current elim round shown in detail (default to first)
  const currentElimRound = selection.stage === "elim"
    ? (selection.elimRound ?? elimRounds[0])
    : elimRounds[0];

  const qualRows: CompResultRow[] =
    catGroup?.results.map((r) => ({
      id: r.id,
      shooterId: r.shooterId,
      firstName: r.firstName,
      lastName: r.lastName,
      birthYear: r.birthYear,
      clubDisplay: r.clubName ?? r.clubNocCode ?? "",
      nationality: r.nationality,
      qualTotal: r.qualTotal,
      qualRank: r.qualRank,
      qualInners: r.qualInners,
      qualified: r.qualified,
      qualDetail: r.qualDetail,
      remark: r.qualRemark,
      remarkDetails: r.remarkDetails?.qual ?? null,
      disciplineCode: group?.code ?? "",
      apparatus: group?.apparatus ?? null,
    })) ?? [];

  // Elim rows reuse CompetitionQualTable's row shape so both tables render identically
  const elimRows: CompResultRow[] =
    catGroup?.results
      .filter((r) => r.elimRound === currentElimRound)
      .map((r) => ({
        id: r.id,
        shooterId: r.shooterId,
        firstName: r.firstName,
        lastName: r.lastName,
        birthYear: r.birthYear,
        clubDisplay: r.clubName ?? r.clubNocCode ?? "",
        nationality: r.nationality,
        qualTotal: r.elimTotal != null ? String(r.elimTotal) : null,
        qualRank: r.elimRank,
        qualInners: r.elimDetail?.inners ?? null,
        // Elimination is a separate performance from qualification — no "Q"
        // (qualified-for-final) badge here, but its own remark now flows
        // through independently instead of being copied from qual.
        qualified: null,
        qualDetail: r.elimDetail,
        remark: r.elimRemark,
        remarkDetails: r.remarkDetails?.elim ?? null,
        disciplineCode: group?.code ?? "",
        apparatus: group?.apparatus ?? null,
      })) ?? [];

  const rawFinalRows: FinalResultRow[] =
    catGroup?.results
      // DSQ/DNS in the final has neither rank nor total — keep it visible via its remark.
      .filter((r) => r.finalRank != null || r.finalTotal != null || r.finalRemark != null)
      .map((r) => ({
        id: r.id,
        shooterId: r.shooterId,
        firstName: r.firstName,
        lastName: r.lastName,
        birthYear: r.birthYear,
        avatarUrl: r.avatarUrl,
        clubDisplay: r.clubName ?? r.clubNocCode ?? "",
        nationality: r.nationality,
        finalTotal: r.finalTotal,
        finalRank: r.finalRank,
        finalDetail: r.finalDetail,
        remark: r.finalRemark,
        remarkDetails: r.remarkDetails?.final ?? null,
      })) ?? [];
  // Stara finala (samo zbirovi serija) → isti prikaz kao live: Klečeći/Ležeći… ili S1, S2, 11–12…
  const finalRowsByRank = [...rawFinalRows].sort((a, b) => (a.finalRank ?? Infinity) - (b.finalRank ?? Infinity));
  const displayDetails = normalizeFinalDetailsForDisplay(group?.code ?? "", finalRowsByRank.map((r) => r.finalDetail));
  const finalRows: FinalResultRow[] = finalRowsByRank.map((r, i) => ({ ...r, finalDetail: displayDetails[i] as FinalResultRow["finalDetail"] }));
  const finalSlot = selection.kind === "individual"
    ? finalSlots.find((slot) => slot.disciplineCode === selection.disciplineCode && slot.category === selection.category)
    : undefined;
  const showFinalMedals = shouldShowFinalMedals(
    finalSlot,
    [...finalRows].sort((a, b) => (a.finalRank ?? Infinity) - (b.finalRank ?? Infinity)).map((r) => r.finalDetail),
    now,
  );

  // Build stage toggle options in correct order: Elim → Qual → Final
  type StageOption = { key: Stage; label: string; shortLabel: string; badge: React.ReactNode };
  const phaseL = PHASE_LABELS[locale] ?? PHASE_LABELS.en;
  const stageOptions: StageOption[] = [
    ...(hasElim ? [{ key: "elim" as Stage, label: phaseL.elim, shortLabel: "Elim.", badge: <PhaseBadge label="E" elim={selection.stage === "elim"} /> }] : []),
    ...(hasQual ? [{ key: "qual" as Stage, label: phaseL.qual, shortLabel: locale === "en" ? "Qual." : "Kval.", badge: <PhaseBadge label="Q" active={selection.stage === "qual"} /> }] : []),
    ...(hasFinal ? [{ key: "final" as Stage, label: phaseL.final, shortLabel: phaseL.final, badge: <PhaseBadge label="F" accent={selection.stage === "final"} /> }] : []),
  ];

  // If the selected stage no longer applies (e.g. qual hasn't started yet), fall back to a valid one
  const effectiveStage: Stage = stageOptions.some((o) => o.key === selection.stage)
    ? selection.stage
    : (stageOptions[0]?.key ?? "qual");

  return (
    <div>
      {/* ── Detail header ───────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-5">
        <button
          onClick={onBack}
          className="mt-0.5 shrink-0 flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-150"
          aria-label={locale === "en" ? "Back to disciplines" : "Nazad na pregled disciplina"}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Nazad
        </button>

        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span
            className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded shrink-0"
            style={{ background: "var(--brand-primary)", color: "#fff", letterSpacing: "0.06em" }}
          >
            {group?.code ?? selection.disciplineCode}
          </span>
          <h3
            className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[var(--ink)] uppercase"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            {disciplineName(group?.code ?? selection.disciplineCode, locale)}
          </h3>
          {group?.label && (
            <span className="text-[0.72rem] font-semibold text-[var(--brand-primary)]">{group.label}</span>
          )}
          {group?.date && (
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)]">{ddmm(group.date)}</span>
          )}
          {showCategory && (
            <span className="text-[0.72rem] font-[family-name:var(--font-barlow-condensed)] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {CATEGORY_LABEL[selection.category]}
            </span>
          )}
        </div>
      </div>

      {/* ── Stage toggle ─────────────────────────────────────────── */}
      {(stageOptions.length > 1 || (effectiveStage === "elim" && elimRounds.length > 1)) && (
        <div className={`mb-4 flex w-full flex-col items-start sm:inline-flex sm:w-auto ${elimRounds.length > 1 ? "min-h-[5rem]" : ""}`}>
          {stageOptions.length > 1 && (
            <div className={`${stageOptions.length === 3 ? "grid-cols-3" : "grid-cols-2"} grid w-full items-center gap-0.5 border border-[var(--border)] bg-[var(--surface)] p-1 sm:flex sm:w-auto ${effectiveStage === "elim" && elimRounds.length > 1 ? "rounded-t-lg rounded-br-lg rounded-bl-none" : "rounded-lg"}`}>
              {stageOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => onStageChange(opt.key, opt.key === "elim" ? currentElimRound : undefined)}
                  aria-label={opt.label}
                  className={`relative flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors duration-150 sm:px-4 ${
                    effectiveStage === opt.key
                      ? "text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {effectiveStage === opt.key && (
                    <motion.span
                      layoutId="active-stage-selector"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-md bg-[var(--bg)] shadow-sm"
                      transition={selectorTransition}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {opt.badge}
                    <span className="sm:hidden">{opt.key === "qual" && stageOptions.length === 2 ? opt.label : opt.shortLabel}</span>
                    <span className="hidden sm:inline">{opt.label}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <AnimatePresence initial={false}>
            {effectiveStage === "elim" && elimRounds.length > 1 && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : {
                  opacity: 0,
                  y: -8,
                  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                }}
                transition={selectorTransition}
                className={`${stageOptions.length > 1 ? "-mt-px rounded-br-lg rounded-bl-lg border-t-0" : "rounded-lg"} flex w-fit items-center gap-0.5 border border-[var(--border)] bg-[var(--surface)] p-1`}
              >
                {elimRounds.map((rnd) => (
                  <button
                    key={rnd}
                    onClick={() => onStageChange("elim", rnd)}
                    className={`relative px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
                      currentElimRound === rnd
                        ? "text-[var(--ink)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {currentElimRound === rnd && (
                      <motion.span
                        layoutId="active-elim-round-selector"
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md bg-[var(--bg)] shadow-sm"
                        transition={selectorTransition}
                      />
                    )}
                    <span className="relative z-10">Relay {rnd}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {effectiveStage === "elim" ? (
          <motion.div
            key={`elim-${currentElimRound}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
          >
            <CompetitionQualTable results={elimRows} competitionLevel={competitionLevel} />
          </motion.div>
        ) : effectiveStage === "qual" ? (
          <motion.div
            key="qual"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
          >
            <CompetitionQualTable results={qualRows} competitionLevel={competitionLevel} />
          </motion.div>
        ) : (
          <motion.div
            key="final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
          >
            <CompetitionFinalTable results={finalRows} competitionLevel={competitionLevel} showMedals={showFinalMedals} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
