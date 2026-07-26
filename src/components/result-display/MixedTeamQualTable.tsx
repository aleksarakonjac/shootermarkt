"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { displayNoc } from "@/lib/noc-list";

export type MixedTeamRow = {
  id: number;
  nocCode: string;
  shooter1Id: number | null;
  shooter2Id: number | null;
  shooter1Name: string | null;
  shooter2Name: string | null;
  shooter1Detail: { series: number[]; total: number } | null;
  shooter2Detail: { series: number[]; total: number } | null;
  qualRank: number | null;
  qualTotal: string | null;
  qualified: boolean | null;
  finalRank: number | null;
  finalTotal: string | null;
};

interface Props {
  teams: MixedTeamRow[];
  /** air_rifle → decimals (10.9), air_pistol → integers */
  apparatus: string | null;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--subtle)]"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 180ms ease" }}
    >
      <path d="M2.5 5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Fixed pixel widths — see CompetitionQualTable for why CSS Grid (not a real
// <table>) is required.
const RANK_W = "48px";
const NAME_W = "minmax(160px, 1fr)";
const TOTAL_W = "64px";
const STATUS_W = "36px";

export function MixedTeamQualTable({ teams, apparatus }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
        <p className="text-sm text-[var(--muted)]">Nema rezultata za ovu disciplinu.</p>
      </div>
    );
  }

  const hasDecimals = apparatus === "air_rifle";
  const fmt = (v: number) => hasDecimals ? v.toFixed(1) : Math.round(v).toString();

  const sorted = [...teams].sort((a, b) => {
    if (a.qualRank == null && b.qualRank == null) return 0;
    if (a.qualRank == null) return 1;
    if (b.qualRank == null) return -1;
    return a.qualRank - b.qualRank;
  });

  const hasSeriesDetail = sorted.some((t) => (t.shooter1Detail?.series?.length ?? 0) > 0 || (t.shooter2Detail?.series?.length ?? 0) > 0);

  const gridTemplateColumns = [RANK_W, NAME_W, TOTAL_W, STATUS_W].join(" ");
  const totalCols = 4;

  const allExpanded = hasSeriesDetail && sorted.every((t) => expanded.has(t.id));
  const toggleAll = () => {
    setExpanded(allExpanded ? new Set() : new Set(sorted.map((t) => t.id)));
  };
  const toggleTeam = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      {hasSeriesDetail && (
        <div className="flex items-center justify-end px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            {allExpanded ? "Sakrij serije" : "Prikaži sve serije"}
            <ChevronIcon open={allExpanded} />
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <div role="table" className="text-sm grid" style={{ gridTemplateColumns, minWidth: `${totalCols * 56 + 40}px` }}>
          <div role="row" style={{ display: "contents" }}>
            <div role="columnheader" className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center justify-end bg-[var(--surface)] border-b border-[var(--border)]">
              #
            </div>
            <div role="columnheader" className="px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center bg-[var(--surface)] border-b border-[var(--border)]">
              Tim / Strelac
            </div>
            <div role="columnheader" className="px-3 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--ink)] flex items-center justify-end bg-[var(--surface)] border-b border-[var(--border)]">
              Σ
            </div>
            <div role="columnheader" className="px-2 py-3 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center justify-center bg-[var(--surface)] border-b border-[var(--border)]">
              F
            </div>
          </div>

          {sorted.map((team, teamIdx) => {
            const isOdd = teamIdx % 2 === 1;
            const rowBg = isOdd ? "var(--surface)" : "var(--bg)";
            const isTeamLastRow = teamIdx === sorted.length - 1;

            const noc = displayNoc(team.nocCode);
            const alpha2 = NOC_LIST.find((n) => n.noc === noc)?.alpha2;

            const s1 = team.shooter1Detail;
            const s2 = team.shooter2Detail;
            const teamHasSeries = (s1?.series?.length ?? 0) > 0 || (s2?.series?.length ?? 0) > 0;
            const isExpanded = expanded.has(team.id);

            return (
              <div key={team.id} role="rowgroup" style={{ display: "contents" }}>
                {/* ── Shooter 1 row (man for rifle, or first for pistol) ── */}
                <div
                  role="row"
                  className="group"
                  style={{ display: "contents", cursor: teamHasSeries ? "pointer" : undefined }}
                  onClick={teamHasSeries ? () => toggleTeam(team.id) : undefined}
                >
                  {/* Rank + expand chevron (spans shooter 1 + shooter 2 rows) */}
                  <div
                    className="px-3 py-2.5 flex items-center justify-end gap-1 border-b border-[var(--border)] group-hover:bg-[var(--surface-2)] transition-colors"
                    style={{ gridRow: "span 2", background: rowBg }}
                  >
                    {teamHasSeries && <ChevronIcon open={isExpanded} />}
                    {team.qualRank != null ? (
                      <span className={`font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums ${
                        team.qualRank <= 3 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"
                      }`}>
                        {team.qualRank}
                      </span>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </div>

                  {/* NOC + name (shooter 1) */}
                  <div className="px-4 py-2 flex items-center border-b-0 group-hover:bg-[var(--surface-2)] transition-colors" style={{ background: rowBg }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">
                        {alpha2 && (
                          <span
                            className={`fi fi-${alpha2.toLowerCase()}`}
                            style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block", flexShrink: 0 }}
                          />
                        )}
                        {noc}
                      </span>
                      {team.shooter1Id ? (
                        <Link
                          href={`/strelci/${team.shooter1Id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors text-sm truncate"
                        >
                          {team.shooter1Name ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--ink)] text-sm truncate">{team.shooter1Name ?? "—"}</span>
                      )}
                      <span className="text-[0.6rem] font-bold text-[var(--muted)] uppercase tracking-wide ml-0.5 shrink-0">M</span>
                    </div>
                  </div>

                  {/* Subtotal — shooter 1 */}
                  <div
                    className="px-3 py-2 flex items-center justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--ink)] font-semibold group-hover:bg-[var(--surface-2)] transition-colors"
                    style={{ background: rowBg }}
                  >
                    {s1?.total != null ? fmt(s1.total) : <span className="font-normal text-[var(--subtle)]">—</span>}
                  </div>

                  {/* Q — spans shooter 1 + shooter 2 rows */}
                  <div
                    className="px-2 py-2.5 flex items-center justify-center border-b border-[var(--border)] group-hover:bg-[var(--surface-2)] transition-colors"
                    style={{ gridRow: "span 2", background: rowBg }}
                  >
                    {team.qualified === true ? (
                      <span
                        className="inline-block w-4 h-4 rounded-full text-[0.6rem] font-bold text-white flex items-center justify-center"
                        style={{ background: "var(--brand-primary)" }}
                        title="Finalista"
                      >
                        ✓
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* ── Shooter 2 row (woman) ── */}
                <div
                  role="row"
                  className="group"
                  style={{ display: "contents", cursor: teamHasSeries ? "pointer" : undefined }}
                  onClick={teamHasSeries ? () => toggleTeam(team.id) : undefined}
                >
                  {/* NOC + name (shooter 2) */}
                  <div className="px-4 py-2 flex items-center border-b border-[var(--border)] group-hover:bg-[var(--surface-2)] transition-colors" style={{ background: rowBg }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-[2.75rem] shrink-0" />
                      {team.shooter2Id ? (
                        <Link
                          href={`/strelci/${team.shooter2Id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors text-sm truncate"
                        >
                          {team.shooter2Name ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--ink)] text-sm truncate">{team.shooter2Name ?? "—"}</span>
                      )}
                      <span className="text-[0.6rem] font-bold text-[var(--muted)] uppercase tracking-wide ml-0.5 shrink-0">Ž</span>
                    </div>
                  </div>

                  {/* Subtotal — shooter 2 */}
                  <div
                    className="px-3 py-2 flex items-center justify-end border-b border-[var(--border)] font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--ink)] font-semibold group-hover:bg-[var(--surface-2)] transition-colors"
                    style={{ background: rowBg }}
                  >
                    {s2?.total != null ? fmt(s2.total) : <span className="font-normal text-[var(--subtle)]">—</span>}
                  </div>
                </div>

                {/* ── Expanded series detail — compact, spans full width ── */}
                {teamHasSeries && isExpanded && (
                  <div role="row" style={{ display: "contents" }}>
                    <div
                      style={{ gridColumn: "1 / -1", background: rowBg }}
                      className="px-3 py-2 flex flex-wrap gap-x-5 gap-y-1.5 border-b-2 border-[var(--border)]"
                    >
                      {[{ label: "M", detail: s1 }, { label: "Ž", detail: s2 }].map(({ label, detail }) => {
                        if (!detail) return null;
                        const bestIdx = detail.series.indexOf(Math.max(...detail.series));
                        return (
                          <div key={label} className="flex flex-col gap-0.5">
                            <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">{label}</span>
                            <div className="flex gap-2 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">
                              {detail.series.map((v, vi) => (
                                <span key={vi} className={vi === bestIdx ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>
                                  {fmt(v)}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Team total row ── */}
                <div role="row" style={{ display: "contents" }}>
                  <div style={{ background: rowBg }} className={isTeamLastRow ? "" : "border-b-2 border-[var(--border)]"} />
                  <div className={`px-4 pb-2.5 pt-1 flex items-center ${isTeamLastRow ? "" : "border-b-2 border-[var(--border)]"}`} style={{ background: rowBg }}>
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--muted)]">
                      Tim ukupno
                    </span>
                  </div>
                  <div
                    className={`px-3 pb-2.5 pt-1 flex items-center justify-end font-[family-name:var(--font-jetbrains-mono)] font-bold text-base tabular-nums text-[var(--ink)] ${isTeamLastRow ? "" : "border-b-2 border-[var(--border)]"}`}
                    style={{ background: rowBg }}
                  >
                    {team.qualTotal ?? <span className="font-normal text-[var(--subtle)]">—</span>}
                  </div>
                  <div style={{ background: rowBg }} className={isTeamLastRow ? "" : "border-b-2 border-[var(--border)]"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
