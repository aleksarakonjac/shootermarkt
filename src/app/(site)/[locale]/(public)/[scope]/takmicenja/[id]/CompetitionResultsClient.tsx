"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { QualDetail, FinalDetail, AgeCategory } from "@/lib/db/schema";
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
      nationality: string | null;
      clubName: string | null;
      clubNocCode: string | null;
      elimRound: number | null;
      elimTotal: number | null;
      elimRank: number | null;
      qualTotal: string | null;
      qualRank: number | null;
      qualInners: number | null;
      qualified: boolean | null;
      qualDetail: QualDetail | null;
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
}

// ── Fade variants ─────────────────────────────────────────────────────────────

const fadeVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
  exit:   { opacity: 0, y: -4, transition: { duration: 0.12, ease: "easeIn" as const } },
};

// ── Phase labels ──────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  elim: "Eliminacije",
  qual: "Kvalifikacije",
  final: "Finale",
};

// ── Root ──────────────────────────────────────────────────────────────────────

export function CompetitionResultsClient({ groups, mixedGroups, competitionId }: Props) {
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
          Nema unetih rezultata za ovo takmičenje.
        </p>
        <p className="mx-auto text-xs text-[var(--subtle)] mt-1">
          Admin može uvesti rezultate iz PDF biltena ili ISSF-a.
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
  onSelectIndividual,
  onSelectMixed,
}: {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
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
              <span className="text-sm font-semibold text-[var(--ink)]">{g.name}</span>
              <span className="text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] ml-auto">
                {totalShooters} str.
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
              {singleCat && singleCatData ? (
                /* Single category: show phase rows directly */
                <SingleCatRows
                  catData={singleCatData}
                  onSelect={(stage, elimRound) => onSelectIndividual(g.code, singleCatData.category, stage, elimRound)}
                />
              ) : (
                /* Multiple categories: category rows */
                g.categories.map((cat) => {
                  const hasFinal = cat.results.some((r) => r.finalRank != null || r.finalTotal != null);
                  const hasElim = cat.results.some((r) => r.elimRound != null);
                  return (
                    <button
                      key={cat.category}
                      onClick={() => onSelectIndividual(g.code, cat.category, hasElim ? "elim" : "qual")}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm font-semibold text-[var(--ink)] truncate">
                          {CATEGORY_LABEL[cat.category]}
                        </span>
                        <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)]">
                          {cat.results.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasElim && <PhaseBadge label="E" elim />}
                        <PhaseBadge label="KV" active />
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
            <span className="text-sm font-semibold text-[var(--ink)]">{g.name}</span>
            <span className="text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)] ml-auto">
              {g.teams.length} tim.
            </span>
          </div>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => onSelectMixed(g.code)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-sm font-semibold text-[var(--ink)]">Mešoviti tim</span>
                <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)]">
                  {g.teams.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <PhaseBadge label="KV" active />
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
  onSelect,
}: {
  catData: DisciplineGroup["categories"][number];
  onSelect: (stage: Stage, elimRound?: number) => void;
}) {
  const hasElim = catData.results.some((r) => r.elimRound != null);
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
                {PHASE_LABEL.elim} R{rnd}
              </span>
              <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)]">
                {count}
              </span>
            </div>
            <ChevronRight size={14} className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150" aria-hidden="true" />
          </button>
        );
      })}

      {/* Qualification */}
      <button
        onClick={() => onSelect("qual")}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <PhaseBadge label="KV" active />
          <span className="text-sm font-semibold text-[var(--ink)] truncate">
            {PHASE_LABEL.qual}
          </span>
          <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)]">
            {catData.results.length}
          </span>
        </div>
        <ChevronRight size={14} className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150" aria-hidden="true" />
      </button>

      {/* Final */}
      {hasFinal && (
        <button
          onClick={() => onSelect("final")}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <PhaseBadge label="F" accent />
            <span className="text-sm font-semibold text-[var(--ink)] truncate">
              {PHASE_LABEL.final}
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
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)]"
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
  onBack,
  onStageChange,
}: {
  groups: DisciplineGroup[];
  mixedGroups: MixedTeamGroup[];
  selection: Selection;
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
            aria-label="Nazad na pregled disciplina"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Nazad
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
                Mešoviti tim
              </span>
            </div>
            <h3
              className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[var(--ink)] uppercase truncate"
              style={{ fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}
            >
              {mixedGroup?.name}
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
                  <><PhaseBadge label="KV" active={selection.stage === "qual"} />Kvalifikacija</>
                ) : (
                  <><PhaseBadge label="F" accent={selection.stage === "final"} />Finale</>
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
      clubDisplay: r.clubName ?? r.clubNocCode ?? "",
      nationality: r.nationality,
      qualTotal: r.qualTotal,
      qualRank: r.qualRank,
      qualInners: r.qualInners,
      qualified: r.qualified,
      qualDetail: r.qualDetail,
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
  const stageOptions: StageOption[] = [
    ...(hasElim ? [{ key: "elim" as Stage, label: "Eliminacije", badge: <PhaseBadge label="E" elim={selection.stage === "elim"} /> }] : []),
    { key: "qual" as Stage, label: "Kvalifikacije", badge: <PhaseBadge label="KV" active={selection.stage === "qual"} /> },
    ...(hasFinal ? [{ key: "final" as Stage, label: "Finale", badge: <PhaseBadge label="F" accent={selection.stage === "final"} /> }] : []),
  ];

  return (
    <div>
      {/* ── Detail header ───────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-5">
        <button
          onClick={onBack}
          className="mt-0.5 shrink-0 flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-150"
          aria-label="Nazad na pregled disciplina"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Nazad
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] font-bold px-2 py-0.5 rounded shrink-0"
              style={{ background: "var(--brand-primary)", color: "#fff", letterSpacing: "0.06em" }}
            >
              {selection.disciplineCode}
            </span>
            {showCategory && (
              <span className="text-[0.72rem] font-[family-name:var(--font-barlow-condensed)] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {CATEGORY_LABEL[selection.category]}
              </span>
            )}
          </div>
          <h3
            className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[var(--ink)] uppercase truncate"
            style={{ fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            {group?.name}
          </h3>
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
                selection.stage === opt.key
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
      {selection.stage === "elim" && elimRounds.length > 1 && (
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
        {selection.stage === "elim" ? (
          <motion.div
            key={`elim-${currentElimRound}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <ElimTable rows={elimRows} />
          </motion.div>
        ) : selection.stage === "qual" ? (
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
  qualified: boolean | null;
};

function ElimTable({ rows }: { rows: ElimRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-10 text-center">
        <p className="text-sm text-[var(--muted)]">Nema podataka za ovu rundu.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
            <th className="py-2 px-3 text-left text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)] w-8">#</th>
            <th className="py-2 px-3 text-left text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)]">Strelac</th>
            <th className="py-2 px-3 text-right text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)]">Σ</th>
            <th className="py-2 px-3 text-center text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--subtle)] w-8">→</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((r, i) => (
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
                {r.clubDisplay && (
                  <span className="ml-2 text-xs text-[var(--muted)] hidden sm:inline">{r.clubDisplay}</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-right font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]">
                {r.elimTotal ?? "—"}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
