"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { NOC_LIST } from "@/lib/noc-list";
import { trendLabel, type Trend } from "@/lib/forma";
import { CATEGORY_LABEL, type AgeCategory } from "@/lib/pdf-import/types";
import { ShooterSearchSelect, type ShooterOption } from "@/components/ui/ShooterSearchSelect";

function nocAlpha2(noc: string | null): string | null {
  if (!noc) return null;
  return NOC_LIST.find((n) => n.noc === noc)?.alpha2 ?? null;
}

export type H2HMatch = {
  competitionId: number;
  competitionName: string;
  date: string;
  qualTotal: number;
  qualRank: number | null;
};

export type H2HCandidate = {
  shooterId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  clubName: string | null;
  category: AgeCategory;
  forma: number | null;
  trend: Trend | null;
  peak: number | null;
  best3avg: number | null;
  seasonAvg: number | null;
  recent3avg: number | null;
  appearances: number;
  matches: H2HMatch[];
};

export type H2HLabels = {
  h2hPickPrompt: string;
  h2hSwap: string;
  h2hPickBoth: string;
  h2hCommonMeets: string;
  h2hNoCommonMeets: string;
  h2hStat_forma: string;
  h2hStat_peak: string;
  h2hStat_best3: string;
  h2hStat_seasonAvg: string;
  h2hStat_recent3: string;
  h2hStat_appearances: string;
};

interface Props {
  candidates: H2HCandidate[];
  labels: H2HLabels;
  seasonLabel: string;
  initialP1?: number;
  initialP2?: number;
}

function fmt(v: number | null): string {
  return v === null ? "—" : v.toFixed(1);
}

function candidateToOption(c: H2HCandidate): ShooterOption {
  return {
    id: c.shooterId,
    firstName: c.firstName,
    lastName: c.lastName,
    nationality: c.nationality,
    clubName: c.clubName,
  };
}

function StatRow({
  label,
  v1,
  v2,
  suffix = "",
}: {
  label: string;
  v1: number | null;
  v2: number | null;
  suffix?: string;
}) {
  const p1Wins = v1 !== null && (v2 === null || v1 > v2);
  const p2Wins = v2 !== null && (v1 === null || v2 > v1);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <span
        className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-right"
        style={{
          fontSize: "1rem",
          color: p1Wins ? "var(--brand-primary)" : "var(--ink)",
        }}
      >
        {v1 !== null ? `${fmt(v1)}${suffix}` : <span className="text-[var(--subtle)]">—</span>}
      </span>
      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] text-center whitespace-nowrap px-2">
        {label}
      </span>
      <span
        className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums"
        style={{
          fontSize: "1rem",
          color: p2Wins ? "var(--brand-primary)" : "var(--ink)",
        }}
      >
        {v2 !== null ? `${fmt(v2)}${suffix}` : <span className="text-[var(--subtle)]">—</span>}
      </span>
    </div>
  );
}

function ShooterHeader({ c }: { c: H2HCandidate | undefined }) {
  if (!c) {
    return (
      <div className="flex flex-col items-center text-center gap-1 py-2">
        <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] border border-[var(--border)]" />
        <span className="text-xs text-[var(--subtle)]">—</span>
      </div>
    );
  }
  const a2 = nocAlpha2(c.nationality);
  return (
    <Link
      href={`/strelci/${c.shooterId}`}
      className="flex flex-col items-center text-center gap-1.5 py-2 group"
    >
      <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden border border-[var(--border)]">
        <span className="font-bold text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] select-none">
          {c.firstName[0]}
          {c.lastName[0]}
        </span>
      </div>
      <div>
        <div className="font-semibold text-sm text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors leading-snug">
          {c.lastName} {c.firstName}
        </div>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          {a2 && (
            <span
              className={`fi fi-${a2.toLowerCase()} shrink-0`}
              style={{ width: "12px", height: "8px", borderRadius: "1px", display: "inline-block" }}
            />
          )}
          <span className="text-[0.7rem] text-[var(--muted)]">{c.clubName ?? CATEGORY_LABEL[c.category]}</span>
        </div>
      </div>
    </Link>
  );
}

export function HeadToHeadPanel({ candidates, labels, seasonLabel, initialP1, initialP2 }: Props) {
  const [p1, setP1] = useState<number | null>(initialP1 ?? null);
  const [p2, setP2] = useState<number | null>(initialP2 ?? null);

  const c1 = candidates.find((c) => c.shooterId === p1);
  const c2 = candidates.find((c) => c.shooterId === p2);

  const candidateOptions = useMemo(() => candidates.map(candidateToOption), [candidates]);

  const commonMatches = useMemo(() => {
    if (!c1 || !c2) return [];
    const c2ByComp = new Map(c2.matches.map((m) => [m.competitionId, m]));
    return c1.matches
      .filter((m) => c2ByComp.has(m.competitionId))
      .map((m1) => ({ m1, m2: c2ByComp.get(m1.competitionId)! }))
      .sort((a, b) => (a.m1.date < b.m1.date ? 1 : -1));
  }, [c1, c2]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Pickers */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[var(--border)]">
        <ShooterSearchSelect
          options={candidateOptions}
          value={p1}
          onChange={(s) => setP1(s.id)}
          excludeId={p2}
          placeholder={labels.h2hPickPrompt}
        />
        <button
          onClick={() => {
            const a = p1;
            setP1(p2);
            setP2(a);
          }}
          disabled={!p1 && !p2}
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
          aria-label={labels.h2hSwap}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 5h10M9 2l3 3-3 3M12 9H2M5 6L2 9l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <ShooterSearchSelect
          options={candidateOptions}
          value={p2}
          onChange={(s) => setP2(s.id)}
          excludeId={p1}
          placeholder={labels.h2hPickPrompt}
        />
      </div>

      {!c1 || !c2 ? (
        <div className="py-16 text-center px-5">
          <p className="text-sm text-[var(--muted)]">{labels.h2hPickBoth}</p>
        </div>
      ) : (
        <>
          {/* Headers */}
          <div className="grid grid-cols-2 px-5 pt-4">
            <ShooterHeader c={c1} />
            <ShooterHeader c={c2} />
          </div>

          {/* Stats */}
          <div className="px-5 pb-2">
            <StatRow
              label={`${labels.h2hStat_forma} ${c1.trend ? trendLabel(c1.trend) : ""}`.trim()}
              v1={c1.forma}
              v2={c2.forma}
            />
            <StatRow label={labels.h2hStat_peak} v1={c1.peak} v2={c2.peak} />
            <StatRow label={labels.h2hStat_best3} v1={c1.best3avg} v2={c2.best3avg} />
            <StatRow label={`${labels.h2hStat_seasonAvg} · ${seasonLabel}`} v1={c1.seasonAvg} v2={c2.seasonAvg} />
            <StatRow label={labels.h2hStat_recent3} v1={c1.recent3avg} v2={c2.recent3avg} />
            <StatRow label={labels.h2hStat_appearances} v1={c1.appearances} v2={c2.appearances} suffix="" />
          </div>

          {/* Common meets */}
          <div className="border-t border-[var(--border)] px-5 py-4">
            <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
              {labels.h2hCommonMeets}
            </h4>
            {commonMatches.length === 0 ? (
              <p className="text-xs text-[var(--subtle)]">{labels.h2hNoCommonMeets}</p>
            ) : (
              <div className="space-y-1.5">
                {commonMatches.map(({ m1, m2 }) => {
                  const p1Better = m1.qualTotal > m2.qualTotal;
                  const p2Better = m2.qualTotal > m1.qualTotal;
                  return (
                    <div
                      key={m1.competitionId}
                      className="flex items-center gap-3 py-1.5 text-xs"
                    >
                      <span
                        className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums w-14 text-right"
                        style={{ color: p1Better ? "var(--brand-primary)" : "var(--muted)" }}
                      >
                        {m1.qualTotal.toFixed(1)}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-[var(--muted)] text-center" title={m1.competitionName}>
                        {m1.competitionName}
                        <span className="text-[var(--subtle)]"> · {m1.date}</span>
                      </span>
                      <span
                        className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums w-14"
                        style={{ color: p2Better ? "var(--brand-primary)" : "var(--muted)" }}
                      >
                        {m2.qualTotal.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
