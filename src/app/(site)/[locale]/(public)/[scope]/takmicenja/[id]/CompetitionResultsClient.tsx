"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
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
      qualTotal: string | null;
      qualRank: number | null;
      qualInners: number | null;
      qualified: boolean | null;
      qualDetail: QualDetail | null;
      remark: string | null;
      finalTotal: string | null;
      finalRank: number | null;
      finalDetail: FinalDetail | null;
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

// ── Root ──────────────────────────────────────────────────────────────────────

export function CompetitionResultsClient({ groups, mixedGroups, competitionId, locale }: Props) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);

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
            onSelectIndividual={(code, category, stage, elimRound) =>
              setSelection({ kind: "individual", disciplineCode: code, category, stage, elimRound })
            }
            onSelectMixed={(code) =>
              setSelection({ kind: "mixed", disciplineCode: code, stage: "qual" })
            }
          />
        </motion.div>
      ) : (
        <motion.div key="detail" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <CompetitionDetail
            groups={groups}
            mixedGroups={mixedGroups}
            selection={selection}
            locale={locale}
            onBack={() => setSelection(null)}
            onStageChange={(stage, elimRound) =>
              setSelection((s) => s ? { ...s, stage: stage as Stage, elimRound } : s)
            }
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
                {(PHASE_LABELS[locale] ?? PHASE_LABELS.en).elim} R{rnd}
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
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)]"
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
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)]"
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
        className="inline-flex items-center px-1.5 rounded text-[1rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)]"
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
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)] bg-[var(--surface-2)] text-[var(--subtle)] border border-[var(--border)]">
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
  onBack,
  onStageChange,
}: {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
  selection: Selection;
  locale: string;
  onBack: () => void;
  onStageChange: (stage: string, elimRound?: number) => void;
}) {
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
      name: `${r.lastName} ${r.firstName}`,
      birthYear: r.birthYear,
      clubDisplay: r.clubName ?? r.clubNocCode ?? "",
      nationality: r.nationality,
      qualTotal: r.qualTotal,
      qualRank: r.qualRank,
      qualInners: r.qualInners,
      qualified: r.qualified,
      qualDetail: r.qualDetail,
      remark: r.remark,
      disciplineCode: group?.code ?? "",
      apparatus: group?.apparatus ?? null,
    })) ?? [];

  const elimRows = catGroup?.results
    .filter((r) => r.elimRound === currentElimRound)
    .sort((a, b) => (a.elimRank ?? 999) - (b.elimRank ?? 999))
    .map((r) => ({
      id: r.id,
      shooterId: r.shooterId,
      name: `${r.lastName} ${r.firstName}`,
      clubDisplay: r.clubName ?? r.clubNocCode ?? "",
      nationality: r.nationality,
      elimTotal: r.elimTotal,
      elimRank: r.elimRank,
      elimDetail: r.elimDetail,
      qualified: r.qualified,
    })) ?? [];

  const finalRows: FinalResultRow[] =
    catGroup?.results
      .filter((r) => r.finalRank != null || r.finalTotal != null)
      .map((r) => ({
        id: r.id,
        shooterId: r.shooterId,
        name: `${r.lastName} ${r.firstName}`,
        clubDisplay: r.clubName ?? r.clubNocCode ?? "",
        nationality: r.nationality,
        finalTotal: r.finalTotal,
        finalRank: r.finalRank,
        finalDetail: r.finalDetail,
      })) ?? [];

  // Build stage toggle options in correct order: Elim → Qual → Final
  type StageOption = { key: Stage; label: string; badge: React.ReactNode };
  const phaseL = PHASE_LABELS[locale] ?? PHASE_LABELS.en;
  const stageOptions: StageOption[] = [
    ...(hasElim ? [{ key: "elim" as Stage, label: phaseL.elim, badge: <PhaseBadge label="E" elim={selection.stage === "elim"} /> }] : []),
    ...(hasQual ? [{ key: "qual" as Stage, label: phaseL.qual, badge: <PhaseBadge label="Q" active={selection.stage === "qual"} /> }] : []),
    ...(hasFinal ? [{ key: "final" as Stage, label: phaseL.final, badge: <PhaseBadge label="F" accent={selection.stage === "final"} /> }] : []),
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
      {stageOptions.length > 1 && (
        <div className="flex items-center gap-0.5 mb-4 p-1 bg-[var(--surface)] rounded-lg w-fit border border-[var(--border)]">
          {stageOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onStageChange(opt.key, opt.key === "elim" ? currentElimRound : undefined)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
                effectiveStage === opt.key
                  ? "bg-[var(--bg)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {opt.badge}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Elim round selector ──────────────────────────────────── */}
      {effectiveStage === "elim" && elimRounds.length > 1 && (
        <div className="flex items-center gap-1.5 mb-4">
          {elimRounds.map((rnd) => (
            <button
              key={rnd}
              onClick={() => onStageChange("elim", rnd)}
              className="px-2.5 py-1 rounded-sm text-xs font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide transition-colors"
              style={{
                background: currentElimRound === rnd ? "var(--ink)" : "var(--surface-2)",
                color: currentElimRound === rnd ? "var(--surface)" : "var(--muted)",
              }}
            >
              R{rnd}
            </button>
          ))}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {effectiveStage === "elim" ? (
          <motion.div
            key={`elim-${currentElimRound}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <ElimTable rows={elimRows} locale={locale} disciplineCode={selection.disciplineCode} />
          </motion.div>
        ) : effectiveStage === "qual" ? (
          <motion.div
            key="qual"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <CompetitionQualTable results={qualRows} />
          </motion.div>
        ) : (
          <motion.div
            key="final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <CompetitionFinalTable results={finalRows} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Elimination table ─────────────────────────────────────────────────────────

type ElimRow = {
  id: number;
  shooterId: number;
  name: string;
  clubDisplay: string;
  nationality: string | null;
  elimTotal: number | null;
  elimRank: number | null;
  elimDetail: ElimDetail | null;
  qualified: boolean | null;
};

const R3P_POSITION_LABELS: Record<string, string[]> = {
  sr: ["Klečeći", "Ležeći", "Stojeći"],
  en: ["Kneeling", "Prone", "Standing"],
};

function ElimTable({ rows, locale, disciplineCode }: { rows: ElimRow[]; locale: string; disciplineCode: string }) {
  const fmtElim = (v: number) => disciplineCode.startsWith("AR") ? v.toFixed(1) : String(Math.round(v));
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-10 text-center">
        <p className="text-sm text-[var(--muted)]">{locale === "en" ? "No data for this round." : "Nema podataka za ovu rundu."}</p>
      </div>
    );
  }

  const seriesCount = Math.max(0, ...rows.map((r) => r.elimDetail?.series.length ?? 0));
  const isPositions = seriesCount === 6; // R3P: 2 series per stance (kneeling/prone/standing)
  const posLabels = R3P_POSITION_LABELS[locale] ?? R3P_POSITION_LABELS.en;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: seriesCount > 0 ? `${420 + seriesCount * 56}px` : undefined }}>
          <thead>
            {isPositions && (
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                <th colSpan={3} />
                {posLabels.map((label) => (
                  <th key={label} colSpan={2} className="py-1 px-3 text-center text-[0.6rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)] border-l border-[var(--border)]">
                    {label}
                  </th>
                ))}
                <th colSpan={2} />
              </tr>
            )}
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th className="py-2 px-3 text-left text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)] w-8">#</th>
              <th className="py-2 px-3 text-left text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)]">{locale === "en" ? "Athlete" : "Strelac"}</th>
              <th className="py-2 px-3 text-left text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)]">{locale === "en" ? "Club" : "Klub"}</th>
              {Array.from({ length: seriesCount }).map((_, i) => (
                <th
                  key={i}
                  className={`py-2 px-3 text-right text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)] ${isPositions && i % 2 === 0 ? "border-l border-[var(--border)]" : ""}`}
                  style={{ minWidth: "48px" }}
                >
                  S{i + 1}
                </th>
              ))}
              <th className="py-2 px-3 text-right text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)]">Σ</th>
              <th className="py-2 px-3 text-center text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)] w-8">→</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r, i) => {
              const series = r.elimDetail?.series ?? null;
              return (
                <tr
                  key={r.id}
                  className="bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-75"
                >
                  <td className="py-2.5 px-3 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--subtle)]">
                    {r.elimRank ?? i + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-[var(--ink)]">{r.name}</span>
                    {r.nationality && (
                      <span className="ml-1.5 text-[0.65rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)]">
                        {r.nationality}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-[var(--muted)]">
                    {r.clubDisplay}
                  </td>
                  {Array.from({ length: seriesCount }).map((_, si) => (
                    <td
                      key={si}
                      className={`py-2.5 px-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)] ${isPositions && si % 2 === 0 ? "border-l border-[var(--border)]" : ""}`}
                    >
                      {series?.[si] != null ? fmtElim(series[si]) : "—"}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]">
                    {r.elimTotal != null ? fmtElim(r.elimTotal) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {r.qualified === true && (
                      <span className="text-[0.6rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{
                          background: "color-mix(in oklch, var(--success) 12%, transparent)",
                          color: "var(--success)",
                          border: "1px solid color-mix(in oklch, var(--success) 22%, transparent)",
                        }}
                      >
                        KV
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
