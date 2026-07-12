"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

type Selection = {
  disciplineCode: string;
  category: AgeCategory;
  stage: "qual" | "final";
};

interface Props {
  groups: DisciplineGroup[];
}

// ── Fade variants ─────────────────────────────────────────────────────────────

const fadeVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
  exit:   { opacity: 0, y: -4, transition: { duration: 0.12, ease: "easeIn" as const } },
};

// ── Root ──────────────────────────────────────────────────────────────────────

export function CompetitionResultsClient({ groups }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);

  if (groups.length === 0) {
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
            onSelect={(code, category) =>
              setSelection({ disciplineCode: code, category, stage: "qual" })
            }
          />
        </motion.div>
      ) : (
        <motion.div key="detail" variants={fadeVariants} initial="hidden" animate="visible" exit="exit">
          <CompetitionDetail
            groups={groups}
            selection={selection}
            onBack={() => setSelection(null)}
            onStageChange={(stage) => setSelection((s) => (s ? { ...s, stage } : s))}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function CompetitionOverview({
  groups,
  onSelect,
}: {
  groups: DisciplineGroup[];
  onSelect: (code: string, category: AgeCategory) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const totalShooters = g.categories.reduce((s, c) => s + c.results.length, 0);
        return (
          <div key={g.code}>
            {/* Discipline header */}
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

            {/* Category rows */}
            <div className="rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
              {g.categories.map((cat) => {
                const hasFinal = cat.results.some(
                  (r) => r.finalRank != null || r.finalTotal != null
                );
                return (
                  <button
                    key={cat.category}
                    onClick={() => onSelect(g.code, cat.category)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors duration-150 group text-left"
                  >
                    {/* Left: category label + count */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-semibold text-[var(--ink)] truncate">
                        {CATEGORY_LABEL[cat.category]}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[0.68rem] text-[var(--muted)]">
                        {cat.results.length}
                      </span>
                    </div>

                    {/* Right: phase badges + chevron */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <PhaseBadge label="KV" active />
                      {hasFinal && <PhaseBadge label="F" accent />}
                      <ChevronRight
                        size={14}
                        className="text-[var(--subtle)] group-hover:text-[var(--ink)] transition-colors duration-150 ml-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Phase badge ───────────────────────────────────────────────────────────────

function PhaseBadge({
  label,
  active = false,
  accent = false,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
}) {
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
  selection,
  onBack,
  onStageChange,
}: {
  groups: DisciplineGroup[];
  selection: Selection;
  onBack: () => void;
  onStageChange: (stage: "qual" | "final") => void;
}) {
  const group = groups.find((g) => g.code === selection.disciplineCode);
  const catGroup = group?.categories.find((c) => c.category === selection.category);

  const hasFinal =
    catGroup?.results.some((r) => r.finalRank != null || r.finalTotal != null) ?? false;

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
            <span className="text-[0.72rem] font-[family-name:var(--font-barlow-condensed)] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {CATEGORY_LABEL[selection.category]}
            </span>
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
      {hasFinal && (
        <div className="flex items-center gap-0.5 mb-5 p-1 bg-[var(--surface)] rounded-lg w-fit border border-[var(--border)]">
          {(["qual", "final"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStageChange(s)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors duration-150 ${
                selection.stage === s
                  ? "bg-[var(--bg)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {s === "qual" ? (
                <>
                  <PhaseBadge label="KV" active={selection.stage === "qual"} />
                  Kvalifikacija
                </>
              ) : (
                <>
                  <PhaseBadge label="F" accent={selection.stage === "final"} />
                  Finale
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {selection.stage === "qual" ? (
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
