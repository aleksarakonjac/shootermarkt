"use client";

import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import type { FinalDetail } from "@/lib/db/schema";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { ArApFinalDisplay } from "./ArApFinalDisplay";
import { BulletinFinalDisplay } from "./BulletinFinalDisplay";
import { PositionsFinalDisplay } from "./PositionsFinalDisplay";

export type FinalResultRow = {
  id: number;
  shooterId: number;
  name: string;
  clubDisplay: string;
  nationality: string | null;
  finalTotal: string | null;
  finalRank: number | null;
  finalDetail: FinalDetail | null;
};

interface Props {
  results: FinalResultRow[];
}

const MEDAL_COLOR: Record<number, string> = {
  1: "oklch(0.75 0.14 85)",
  2: "oklch(0.75 0.01 85)",
  3: "oklch(0.60 0.10 55)",
};

function MedalIcon({ rank }: { rank: number }) {
  const color = MEDAL_COLOR[rank];
  if (!color) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.65rem] font-bold text-white shrink-0"
      style={{ background: color }}
      aria-label={`Mesto ${rank}`}
    >
      {rank}
    </span>
  );
}

export function CompetitionFinalTable({ results }: Props) {
  const sorted = [...results]
    .filter((r) => r.finalRank != null || r.finalTotal != null)
    .sort((a, b) => {
      if (a.finalRank == null && b.finalRank == null) return 0;
      if (a.finalRank == null) return 1;
      if (b.finalRank == null) return -1;
      return a.finalRank - b.finalRank;
    });
  const isHitCountFinal = sorted.some((result) => result.finalDetail?.format === "bulletin" && result.finalDetail.scoring === "hit_count");

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Nema finalnih rezultata.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <table className="w-full text-sm border-collapse min-w-[360px]">
        <thead>
          <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
            <th className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-12">
              #
            </th>
            <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Strelac
            </th>
            <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Klub / NOC
            </th>
            <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink)] w-24">
              {isHitCountFinal ? "Pogoci" : "Final Σ"}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            return (
              <Fragment key={r.id}>
                <tr className="border-b border-[var(--border)] transition-colors">
                  {/* Rank */}
                  <td className="px-3 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums">
                    {r.finalRank != null ? (
                      MEDAL_COLOR[r.finalRank] ? (
                        <span className="inline-flex justify-end">
                          <MedalIcon rank={r.finalRank} />
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">{r.finalRank}</span>
                      )
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/strelci/${r.shooterId}`}
                      className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors"
                    >
                      {r.name}
                    </Link>
                  </td>

                  {/* Club / NOC */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.nationality && (() => {
                        const alpha2 = NOC_LIST.find((n) => n.noc === r.nationality)?.alpha2;
                        return (
                          <span className="shrink-0 flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">
                            {alpha2 && (
                              <span
                                className={`fi fi-${alpha2.toLowerCase()}`}
                                style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block", flexShrink: 0 }}
                              />
                            )}
                            {r.nationality}
                          </span>
                        );
                      })()}
                      {r.clubDisplay && (
                        <span className="text-[var(--muted)] text-xs truncate">
                          {r.clubDisplay}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Final total */}
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] font-bold text-sm tabular-nums text-[var(--ink)]">
                    {r.finalTotal ?? (
                      <span className="font-normal text-[var(--subtle)]">—</span>
                    )}
                  </td>
                </tr>

                {/* Series detail — always shown, not collapsed */}
                {r.finalDetail && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-4">
                        {r.finalDetail.format === "ar_ap_10m" ? (
                          <ArApFinalDisplay detail={r.finalDetail} />
                        ) : r.finalDetail.format === "bulletin" ? (
                          <BulletinFinalDisplay detail={r.finalDetail} />
                        ) : (
                          <PositionsFinalDisplay detail={r.finalDetail} />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
