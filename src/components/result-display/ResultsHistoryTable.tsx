"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { QualDetail, FinalDetail } from "@/lib/db/schema";
import { ResultDetailPanel } from "./ResultDetailPanel";

const CATEGORY_SHORT: Record<string, string> = {
  pionir: "PIO", kadet: "KAD", mladji_junior: "MJ", junior: "JR",
  mladji_senior: "U23", senior: "SR", master: "MST", open: "OPN",
};

export type ResultRowData = {
  id: number;
  qualTotal: string | null;
  qualRank: number | null;
  qualInners: number | null;
  qualified: boolean | null;
  finalTotal: string | null;
  finalRank: number | null;
  competitionName: string;
  competitionDate: string;
  disciplineCode: string;
  category?: string | null;
  qualDetail: QualDetail | null;
  finalDetail: FinalDetail | null;
};

export function ResultsHistoryTable({ results, allLabel = "Sve", locale = "sr" }: { results: ResultRowData[]; allLabel?: string; locale?: string }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedDisc, setSelectedDisc] = useState<string | null>(null);

  const availableDiscs = Array.from(new Set(results.map(r => r.disciplineCode))).sort();
  const showFilter = availableDiscs.length > 1;

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  const sorted = [...results].reverse();
  const filtered = selectedDisc ? sorted.filter(r => r.disciplineCode === selectedDisc) : sorted;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Discipline filter */}
      {showFilter && (
        <div className="flex gap-1.5 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] flex-wrap">
          <button
            onClick={() => setSelectedDisc(null)}
            className={`text-[11px] font-extrabold font-[family-name:var(--font-barlow-condensed)] tracking-wider uppercase px-2.5 py-1 rounded transition-colors ${
              selectedDisc === null
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {allLabel}
          </button>
          {availableDiscs.map(code => (
            <button
              key={code}
              onClick={() => setSelectedDisc(code)}
              className={`text-[11px] font-extrabold font-[family-name:var(--font-barlow-condensed)] tracking-wider uppercase px-2.5 py-1 rounded transition-colors ${
                selectedDisc === code
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      )}

      <div>
        <table className="w-full table-fixed text-xs sm:text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="w-[42%] px-2 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-4 sm:py-3 sm:text-[0.7rem]">
                {locale === "en" ? "Competition" : "Takmičenje"}
              </th>
              <th className="hidden px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:table-cell">
                {locale === "en" ? "Date" : "Datum"}
              </th>
              <th className="w-[15%] px-1 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-4 sm:py-3 sm:text-[0.7rem]">
                {locale === "en" ? "Disc." : "Disc."}
              </th>
              <th className="w-[22%] px-1 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-4 sm:py-3 sm:text-[0.7rem]">
                {locale === "en" ? "Qual." : "Kval."}
              </th>
              <th className="hidden px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:table-cell">
                {locale === "en" ? "Rank" : "Rang"}
              </th>
              <th className="w-[21%] px-1 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-4 sm:py-3 sm:text-[0.7rem]">
                {locale === "en" ? "Final" : "Finale"}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isExpanded = expanded.has(r.id);
              const canExpand = r.qualDetail != null || r.finalDetail != null;
              const qualDecimals = r.disciplineCode.startsWith("AR");
              const finalDecimals = r.disciplineCode.startsWith("AR") || r.disciplineCode.startsWith("R3P") || r.disciplineCode.startsWith("AP");
              const hasDecimals = qualDecimals; // kept for series/detail downstream
              const fmtQual = (v: string) => qualDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
              const fmtFinal = (v: string) => finalDecimals ? parseFloat(v).toFixed(1) : Math.round(parseFloat(v)).toString();
              const fmt = fmtQual;

              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={canExpand ? () => toggle(r.id) : undefined}
                    className={`border-b border-[var(--border)] transition-colors ${
                      canExpand ? "cursor-pointer" : ""
                    } ${
                      isExpanded ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
                    }`}
                    aria-expanded={canExpand ? isExpanded : undefined}
                  >
                    <td className="px-2 py-2.5 font-medium text-[var(--ink)] sm:px-4 sm:py-3">
                      <span className="block break-words leading-snug">{r.competitionName}</span>
                    </td>
                    <td className="hidden px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] sm:table-cell">
                      {r.competitionDate.split("-").reverse().join(".")}
                    </td>
                    <td className="px-1 py-2.5 sm:px-4 sm:py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block rounded px-1 py-0.5 text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] tracking-wide bg-[var(--surface-2)] text-[var(--ink)] sm:px-2 sm:text-xs">
                          {r.disciplineCode}
                        </span>
                        {r.category && r.category !== "senior" && (
                          <span className="hidden rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide bg-[var(--brand-primary-light)] text-[var(--brand-primary)] sm:inline-block">
                            {CATEGORY_SHORT[r.category] ?? r.category}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-1 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] sm:px-4 sm:py-3">
                      {r.qualTotal != null ? (
                        <>
                          {fmt(r.qualTotal)}
                          {r.qualInners != null && (
                            <span className="ml-0.5 text-[0.65rem] text-[var(--muted)] sm:ml-1 sm:text-xs">{r.qualInners}×</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--subtle)]">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-[var(--muted)] sm:table-cell">
                      {r.qualRank != null ? (
                        <span>
                          <span className="text-[var(--subtle)] text-xs">#</span>
                          {r.qualRank}
                        </span>
                      ) : (
                        <span className="text-[var(--subtle)]">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-1 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] sm:px-4 sm:py-3">
                      <span className="inline-flex items-center gap-1">
                        {r.finalTotal != null ? fmtFinal(r.finalTotal) : <span className="text-[var(--subtle)]">—</span>}
                        {canExpand && (
                        <ChevronDown
                          size={14}
                          className={`text-[var(--muted)] transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                        )}
                      </span>
                    </td>
                  </tr>

                  <tr aria-hidden={!isExpanded}>
                    <td colSpan={6} className="p-0">
                      <div
                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <ResultDetailPanel
                            qualDetail={r.qualDetail}
                            finalDetail={r.finalDetail}
                            hasDecimals={hasDecimals}
                            inners={r.qualInners}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
