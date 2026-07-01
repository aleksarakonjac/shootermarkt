"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { QualDetail, FinalDetail } from "@/lib/db/schema";
import { ResultDetailPanel } from "./ResultDetailPanel";

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
  qualDetail: QualDetail | null;
  finalDetail: FinalDetail | null;
  apparatus: string | null;
};

export function ResultsHistoryTable({ results }: { results: ResultRowData[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const sorted = [...results].reverse();

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Takmičenje
              </th>
              <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] hidden sm:table-cell">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Disc.
              </th>
              <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Kval.
              </th>
              <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] hidden sm:table-cell">
                Rank
              </th>
              <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Final
              </th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isExpanded = expanded.has(r.id);
              const canExpand = r.qualDetail != null || r.finalDetail != null;
              const hasDecimals = r.apparatus === "air_rifle";

              return (
                <Fragment key={r.id}>
                  {/* Main row */}
                  <tr
                    onClick={canExpand ? () => toggle(r.id) : undefined}
                    className={`border-b border-[var(--border)] transition-colors ${
                      canExpand ? "cursor-pointer" : ""
                    } ${
                      isExpanded
                        ? "bg-[var(--surface)]"
                        : "hover:bg-[var(--surface)]"
                    }`}
                    aria-expanded={canExpand ? isExpanded : undefined}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--ink)]">
                      {r.competitionName}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] hidden sm:table-cell">
                      {r.competitionDate}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold font-[family-name:var(--font-barlow-condensed)] tracking-wide bg-[var(--surface-2)] text-[var(--ink)]">
                        {r.disciplineCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">
                      {r.qualTotal != null ? (
                        <>
                          {r.qualTotal}
                          {r.qualInners != null && (
                            <span className="text-xs text-[var(--muted)] ml-1">
                              {r.qualInners}×
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted)] hidden sm:table-cell">
                      {r.qualRank != null ? (
                        <span>
                          <span className="text-[var(--subtle)] text-xs">#</span>
                          {r.qualRank}
                        </span>
                      ) : (
                        <span className="text-[var(--subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)]">
                      {r.finalTotal ?? (
                        <span className="text-[var(--subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {canExpand && (
                        <ChevronDown
                          size={14}
                          className={`text-[var(--muted)] transition-transform duration-200 mx-auto ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </td>
                  </tr>

                  {/* Expand row — always rendered, animated via grid-template-rows */}
                  <tr aria-hidden={!isExpanded}>
                    <td colSpan={7} className="p-0">
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
