"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { QualDetail, FinalDetail, ElimDetail, AgeCategory } from "@/lib/db/schema";
import { CATEGORY_LABEL } from "@/lib/pdf-import/types";
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
  type MixedTeamRow,
} from "@/components/result-display/MixedTeamQualTable";

export type DisciplineGroup = {
  code: string;
  name: string;
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
    }>;
  }>;
};

export type MixedTeamGroup = {
  code: string;
  name: string;
  apparatus: string | null;
  teams: MixedTeamRow[];
};

type Stage = "elim" | "qual" | "final";

type Selection =
  | { kind: "individual"; disciplineCode: string; category: AgeCategory; stage: Stage; elimRound?: number }
  | { kind: "mixed"; disciplineCode: string; stage: Stage; elimRound?: number };

interface Props {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
  competitionId: number;
  locale: string;
  competitionLevel?: string;
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
  APMT: { sr: "10m pištolj miks",    en: "10m pistol mixed" },
  ARMT: { sr: "10m puška miks",      en: "10m rifle mixed" },
  SPW:  { sr: "Sport pištolj Ž",     en: "Sport pistol W" },
  RFPM: { sr: "Brza vatra M",        en: "Rapid fire M" },
  R3JM: { sr: "3×20 puška jr. M",    en: "3×20 rifle jr. M" },
  R3JW: { sr: "3×20 puška jr. Ž",    en: "3×20 rifle jr. W" },
};

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
  return `${(PHASE_LABELS[locale] ?? PHASE_LABELS.en).elim} — ${locale === "en" ? "round" : "partija"} ${round}`;
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function CompetitionResultsClient({ groups, mixedGroups, competitionId, locale, competitionLevel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const detailRef = useRef<HTMLDivElement>(null);

  const urlSelection = useMemo<Selection | null>(() => {
    const params = new URLSearchParams(search);
    const disciplineCode = params.get("disc");
    const stage = params.get("stage");
    if (!disciplineCode || (stage !== "elim" && stage !== "qual" && stage !== "final")) return null;

    const round = Number(params.get("round"));
    const elimRound = stage === "elim" && Number.isInteger(round) && round > 0 ? round : undefined;

    if (params.get("result") === "mixed") {
      return mixedGroups.some((group) => group.code === disciplineCode)
        ? { kind: "mixed", disciplineCode, stage, elimRound }
        : null;
    }

    const category = params.get("category") as AgeCategory | null;
    return category && groups.some((group) => group.code === disciplineCode && group.categories.some((item) => item.category === category))
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
      if (next.kind === "individual") params.set("category", next.category);
      if (next.stage === "elim" && next.elimRound != null) params.set("round", String(next.elimRound));
    }

    const href = params.size > 0 ? `${pathname}?${params}` : pathname;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [pathname, router, search]);

  const retry = useCallback(() => router.refresh(), [router]);

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

  useEffect(() => {
    if (selection) detailRef.current?.scrollIntoView({ block: "start" });
  }, [selection]);

  if (groups.length === 0 && mixedGroups.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
        <p className="mx-auto text-sm font-medium text-[var(--muted)]">
          {locale === "en" ? "No results entered for this competition." : "Nema unetih rezultata za ovo takmičenje."}
        </p>
        <p className="mx-auto text-xs text-[var(--subtle)] mt-1">
          {locale === "en" ? "Admin can import results from a PDF bulletin or ISSF." : "Admin može uvesti rezultate iz PDF biltena ili ISSF-a."}
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selection === null ? (
        <motion.div key="overview" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <CompetitionOverview
            groups={groups}
            mixedGroups={mixedGroups}
            locale={locale}
            onSelectIndividual={(code, category, stage, elimRound) => {
              const next = { kind: "individual" as const, disciplineCode: code, category, stage, elimRound };
              setSelection(next);
              setSelectionUrl(next);
            }}
            onSelectMixed={(code) => {
              const next = { kind: "mixed" as const, disciplineCode: code, stage: "qual" as const };
              setSelection(next);
              setSelectionUrl(next);
            }}
          />
        </motion.div>
      ) : (
        <motion.div ref={detailRef} key="detail" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="scroll-mt-24">
          <CompetitionDetail
            groups={groups}
            mixedGroups={mixedGroups}
            selection={selection}
            locale={locale}
            competitionLevel={competitionLevel}
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
  onSelectMixed: (code: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Individual disciplines */}
      {groups.map((g) => {
        const totalShooters = g.categories.reduce((s, c) => s + c.results.length, 0);
        const singleCat = g.categories.length === 1;
        const singleCatData = singleCat ? g.categories[0] : null;

        return (
          <div key={g.code}>
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded"
                style={{ background: "var(--brand-primary)", color: "#fff", letterSpacing: "0.06em" }}
              >
                {g.code}
              </span>
              <span className="text-sm font-semibold text-[var(--ink)]">{disciplineName(g.code, locale)}</span>
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
                  onSelect={(stage, elimRound) => onSelectIndividual(g.code, singleCatData.category, stage, elimRound)}
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
                      onClick={() => onSelectIndividual(g.code, cat.category, hasQual ? "qual" : "elim")}
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
        );
      })}

      {/* Mixed team disciplines */}
      {mixedGroups.map((g) => (
        <div key={g.code}>
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded"
              style={{ background: "var(--brand-accent, #7c3aed)", color: "#fff", letterSpacing: "0.06em" }}
            >
              {g.code}
            </span>
            <span className="text-sm font-semibold text-[var(--ink)]">{disciplineName(g.code, locale)}</span>
            <span className="text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] ml-auto">
              {g.teams.length} {locale === "en" ? "teams" : "timova"}
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => onSelectMixed(g.code)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-sm font-semibold text-[var(--ink)]">{locale === "en" ? "Mixed team" : "Mešoviti tim"}</span>
                <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)] leading-none self-center translate-y-px">
                  {g.teams.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <PhaseBadge label="Q" active />
                {g.teams.some((t) => t.finalRank != null || t.finalTotal != null) && (
                  <PhaseBadge label="F" accent />
                )}
                <ChevronRight size={14} className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150 ml-0.5" aria-hidden="true" />
              </div>
            </button>
          </div>
        </div>
      ))}
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
  onBack,
  onStageChange,
}: {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
  selection: Selection;
  locale: string;
  competitionLevel?: string;
  onBack: () => void;
  onStageChange: (stage: string, elimRound?: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  const selectorTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  if (selection.kind === "mixed") {
    const mixedGroup = mixedGroups.find((g) => g.code === selection.disciplineCode);
    const hasFinal = mixedGroup?.teams.some((t) => t.finalRank != null || t.finalTotal != null) ?? false;

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
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded shrink-0"
                style={{ background: "var(--brand-accent, #7c3aed)", color: "#fff", letterSpacing: "0.06em" }}
              >
                {selection.disciplineCode}
              </span>
              <span className="text-[0.72rem] font-[family-name:var(--font-barlow-condensed)] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {locale === "en" ? "Mixed team" : "Mešoviti tim"}
              </span>
            </div>
            <h3
              className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[var(--ink)] uppercase truncate"
              style={{ fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}
            >
              {mixedGroup ? disciplineName(mixedGroup.code, locale) : ""}
            </h3>
          </div>
        </div>

        {hasFinal && (
          <div className="flex items-center gap-0.5 mb-5 p-1 bg-[var(--surface)] rounded-lg w-fit border border-[var(--border)]">
            {(["qual", "final"] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStageChange(s)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
                  selection.stage === s ? "bg-[var(--bg)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {s === "qual" ? (
                  <><PhaseBadge label="Q" active={selection.stage === "qual"} />{(PHASE_LABELS[locale] ?? PHASE_LABELS.en).qual}</>
                ) : (
                  <><PhaseBadge label="F" accent={selection.stage === "final"} />{(PHASE_LABELS[locale] ?? PHASE_LABELS.en).final}</>
                )}
              </button>
            ))}
          </div>
        )}

        <MixedTeamQualTable teams={mixedGroup?.teams ?? []} apparatus={mixedGroup?.apparatus ?? null} />
      </div>
    );
  }

  // Individual discipline
  const group = groups.find((g) => g.code === selection.disciplineCode);
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
        disciplineCode: group?.code ?? "",
        apparatus: group?.apparatus ?? null,
      })) ?? [];

  const finalRows: FinalResultRow[] =
    catGroup?.results
      .filter((r) => r.finalRank != null || r.finalTotal != null)
      .map((r) => ({
        id: r.id,
        shooterId: r.shooterId,
        firstName: r.firstName,
        lastName: r.lastName,
        birthYear: r.birthYear,
        clubDisplay: r.clubName ?? r.clubNocCode ?? "",
        nationality: r.nationality,
        finalTotal: r.finalTotal,
        finalRank: r.finalRank,
        finalDetail: r.finalDetail,
        remark: r.finalRemark,
      })) ?? [];

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
            {selection.disciplineCode}
          </span>
          <h3
            className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[var(--ink)] uppercase"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            {disciplineName(selection.disciplineCode, locale)}
          </h3>
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
                    <span className="sm:hidden">{opt.shortLabel}</span>
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
                    <span className="relative z-10">{locale === "en" ? `Round ${rnd}` : `Partija ${rnd}`}</span>
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
            <CompetitionFinalTable results={finalRows} competitionLevel={competitionLevel} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
