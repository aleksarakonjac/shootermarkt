"use client";

import { useState } from "react";
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

interface Props {
  groups: DisciplineGroup[];
}

export function CompetitionResultsClient({ groups }: Props) {
  const [activeDiscipline, setActiveDiscipline] = useState(
    groups[0]?.code ?? ""
  );
  const group = groups.find((g) => g.code === activeDiscipline);

  const [activeCategory, setActiveCategory] = useState<AgeCategory | undefined>(
    group?.categories[0]?.category
  );
  const [stage, setStage] = useState<"qual" | "final">("qual");

  // If the stored category doesn't exist in the current group, fall back to the first.
  const effectiveCategory =
    group?.categories.some((c) => c.category === activeCategory)
      ? activeCategory
      : group?.categories[0]?.category;

  const catGroup = group?.categories.find((c) => c.category === effectiveCategory);
  const hasFinal = catGroup?.results.some(
    (r) => r.finalRank != null || r.finalTotal != null
  ) ?? false;

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

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
        <p className="text-sm font-medium text-[var(--muted)]">
          Nema unetih rezultata za ovo takmičenje.
        </p>
        <p className="text-xs text-[var(--subtle)] mt-1">
          Admin može uvesti rezultate iz PDF biltena ili ISSF-a.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Discipline tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap mb-5">
        {groups.map((g) => (
          <button
            key={g.code}
            onClick={() => {
              setActiveDiscipline(g.code);
              setStage("qual");
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide transition-colors ${
              activeDiscipline === g.code
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
            }`}
          >
            {g.code}
            <span className="ml-1.5 text-[0.65rem] font-normal opacity-70">
              {g.categories.reduce((sum, c) => sum + c.results.length, 0)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Category tabs ────────────────────────────────────────── */}
      {group && group.categories.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {group.categories.map((c) => (
            <button
              key={c.category}
              onClick={() => {
                setActiveCategory(c.category);
                setStage("qual");
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                effectiveCategory === c.category
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-transparent text-[var(--subtle)] border border-[var(--border)] hover:text-[var(--ink)]"
              }`}
            >
              {CATEGORY_LABEL[c.category]}
              <span className="ml-1.5 text-[0.65rem] font-normal opacity-70">
                {c.results.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Stage toggle ─────────────────────────────────────────── */}
      {hasFinal && (
        <div className="flex items-center gap-1 mb-4 p-1 bg-[var(--surface)] rounded-lg w-fit border border-[var(--border)]">
          {(["qual", "final"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                stage === s
                  ? "bg-[var(--bg)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {s === "qual" ? "Kvalifikacija" : "Finale"}
            </button>
          ))}
        </div>
      )}

      {/* ── Results table ────────────────────────────────────────── */}
      {stage === "qual" ? (
        <CompetitionQualTable results={qualRows} />
      ) : (
        <CompetitionFinalTable results={finalRows} />
      )}
    </div>
  );
}
