"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { displayNoc } from "@/lib/noc-list";

export type MixedTeamRow = {
  id: number; nocCode: string; shooter1Id: number | null; shooter2Id: number | null;
  shooter1Name: string | null; shooter2Name: string | null;
  shooter1Detail: { series: number[]; inners?: number | null; total: number } | null; shooter2Detail: { series: number[]; inners?: number | null; total: number } | null;
  qualRank: number | null; qualTotal: string | null; qualInners: number | null; qualRemark: string | null; qualified: boolean | null; finalRank: number | null; finalTotal: string | null; finalRemark: string | null;
};

interface Props { teams: MixedTeamRow[]; apparatus: string | null; stage?: "qual" | "final"; }

const MEDAL_COLOR: Record<number, string> = { 1: "oklch(0.75 0.14 85)", 2: "oklch(0.75 0.01 85)", 3: "oklch(0.60 0.10 55)" };

function MedalIcon({ rank }: { rank: number }) {
  return <span className="inline-flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold text-white" style={{ background: MEDAL_COLOR[rank] }}>{rank}</span>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-[var(--subtle)]" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 180ms ease" }}><path d="M2.5 5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function remarkColor(remark: string) { return remark === "DSQ" || /^A\d/.test(remark) ? "var(--danger)" : "var(--muted)"; }

function RemarkBadge({ remark }: { remark: string }) { return <span className="font-[family-name:var(--font-jetbrains-mono)] text-base font-bold uppercase tracking-wide leading-none" style={{ color: remarkColor(remark) }} title={remark}>{remark}</span>; }

function TeamMember({ id, name, label, total, inners, showInners, fmt }: { id: number | null; name: string | null; label: string; total: number | null; inners: number | null | undefined; showInners: boolean; fmt: (value: number) => string }) {
  const content = <><span className="truncate">{name ?? "—"}</span><span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-wide text-[var(--subtle)]">{label}</span>{total != null && <span className="ml-auto flex shrink-0 items-baseline gap-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold tabular-nums text-[var(--ink)]">{fmt(total)}{showInners && inners != null && <span className="font-normal text-[var(--muted)]">{inners}<span className="text-[0.6rem]">×</span></span>}</span>}</>;
  return id ? <Link href={`/strelci/${id}`} onClick={(event) => event.stopPropagation()} className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--ink)] transition-colors hover:text-[var(--brand-primary)]">{content}</Link> : <span className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--ink)]">{content}</span>;
}

export function MixedTeamQualTable({ teams, apparatus, stage = "qual" }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();
  const isFinal = stage === "final";
  const showInners = !isFinal && apparatus === "air_pistol";
  const rank = (team: MixedTeamRow) => isFinal ? team.finalRank : team.qualRank;
  const total = (team: MixedTeamRow) => isFinal ? team.finalTotal : team.qualTotal;
  const remark = (team: MixedTeamRow) => isFinal ? team.finalRemark : team.qualRemark;
  const fmt = (value: number) => (isFinal || apparatus === "air_rifle" ? value.toFixed(1) : Math.round(value).toString());
  const sorted = teams.filter((team) => !isFinal || total(team) != null || rank(team) != null).toSorted((a, b) => (rank(a) ?? Infinity) - (rank(b) ?? Infinity));
  const hasSeries = !isFinal && sorted.some((team) => (team.shooter1Detail?.series.length ?? 0) > 0 || (team.shooter2Detail?.series.length ?? 0) > 0);
  const allExpanded = hasSeries && sorted.every((team) => expanded.has(team.id));
  const columns = ["32px", "minmax(120px, 1fr)", "minmax(56px, 88px)", "72px", "24px", hasSeries ? "18px" : ""].filter(Boolean).join(" ");
  const header = "flex items-center border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-3";

  if (!sorted.length) return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center"><p className="text-sm text-[var(--muted)]">{isFinal ? "Nema finalnih rezultata." : "Nema rezultata za ovu disciplinu."}</p></div>;
  const toggle = (id: number) => setExpanded((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return <div className="overflow-hidden rounded-xl border border-[var(--border)]">
    {hasSeries && <div className="flex items-center justify-end border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2"><button type="button" onClick={() => setExpanded(allExpanded ? new Set() : new Set(sorted.map((team) => team.id)))} className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)] transition-colors hover:text-[var(--ink)]">{allExpanded ? "Sakrij serije" : "Prikaži sve serije"}<ChevronIcon open={allExpanded} /></button></div>}
    <div className="overflow-x-auto"><div role="table" className="grid text-sm [grid-template-columns:var(--mixed-grid)]" style={{ "--mixed-grid": columns } as CSSProperties}>
      <div role="row" style={{ display: "contents" }}><div role="columnheader" className={`${header} justify-end`}>#</div><div role="columnheader" className={header}>Strelci</div><div role="columnheader" className={header}>NOC</div><div role="columnheader" className={`${header} justify-end`}>Σ</div><div role="columnheader" className={header} aria-hidden="true" />{hasSeries && <div role="columnheader" className={header} aria-hidden="true" />}</div>
      {sorted.map((team, index) => {
        const teamRank = rank(team); const isExpanded = expanded.has(team.id); const isLast = index === sorted.length - 1; const rowBg = index % 2 ? "var(--surface)" : "var(--bg)";
        const cell = `flex items-center px-2 py-2.5 text-sm transition-colors sm:px-3 ${!isLast || isExpanded ? "border-b border-[var(--border)]" : ""}`;
        const memberCell = `flex min-w-0 items-center px-2 py-1.5 text-sm transition-colors sm:px-3`;
        const noc = displayNoc(team.nocCode); const alpha2 = NOC_LIST.find((country) => country.noc === noc)?.alpha2;
        return <div key={team.id} role="rowgroup" style={{ display: "contents" }}>
          <div role="row" className="group" style={{ display: "contents", cursor: hasSeries ? "pointer" : undefined }} onClick={hasSeries ? () => toggle(team.id) : undefined}>
            <div className={`${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums group-hover:bg-[var(--surface-2)]`} style={{ gridRow: "span 2", background: rowBg }}>{teamRank == null ? <span className="text-[var(--subtle)]">—</span> : isFinal && MEDAL_COLOR[teamRank] ? <MedalIcon rank={teamRank} /> : <span className={teamRank <= 3 && !isFinal ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}>{teamRank}</span>}</div>
            <div className={`${memberCell} group-hover:bg-[var(--surface-2)]`} style={{ background: rowBg }}><TeamMember id={team.shooter1Id} name={team.shooter1Name} label="M" total={team.shooter1Detail?.total ?? null} inners={team.shooter1Detail?.inners} showInners={showInners} fmt={fmt} /></div>
            <div className={`${cell} group-hover:bg-[var(--surface-2)]`} style={{ gridRow: "span 2", background: rowBg }}><span className="flex shrink-0 items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold text-[var(--ink)]">{alpha2 && <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block" }} />}{noc}</span></div>
            <div className={`${cell} justify-end gap-1 font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)] group-hover:bg-[var(--surface-2)]`} style={{ gridRow: "span 2", background: rowBg }}>{total(team) != null ? <>{fmt(Number(total(team)))}{showInners && team.qualInners != null && <span className="text-xs font-normal text-[var(--muted)]">{team.qualInners}<span className="text-[0.6rem]">×</span></span>}</> : <span className="font-normal text-[var(--subtle)]">—</span>}</div>
            <div className={`${cell} justify-center font-[family-name:var(--font-jetbrains-mono)] text-base font-bold text-[var(--success)] group-hover:bg-[var(--surface-2)]`} style={{ gridRow: "span 2", background: rowBg }}>{remark(team) ? <RemarkBadge remark={remark(team)!} /> : !isFinal && team.qualified ? "Q" : null}</div>
            {hasSeries && <div className={`${cell} justify-center group-hover:bg-[var(--surface-2)]`} style={{ gridRow: "span 2", background: rowBg }}><ChevronIcon open={isExpanded} /></div>}
            <div className={`${memberCell} ${!isLast || isExpanded ? "border-b border-[var(--border)]" : ""} group-hover:bg-[var(--surface-2)]`} style={{ background: rowBg }}><TeamMember id={team.shooter2Id} name={team.shooter2Name} label="Ž" total={team.shooter2Detail?.total ?? null} inners={team.shooter2Detail?.inners} showInners={showInners} fmt={fmt} /></div>
          </div>
          <AnimatePresence initial={false}>{hasSeries && isExpanded && <motion.div role="row" initial={reducedMotion ? false : { height: 0, opacity: 0, y: -4 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} style={{ gridColumn: "1 / -1", background: rowBg }} className={`min-h-0 overflow-hidden px-3 ${isLast ? "" : "border-b border-[var(--border)]"}`}><div className="flex flex-wrap gap-x-5 gap-y-2 py-2">{[{ label: "M", detail: team.shooter1Detail }, { label: "Ž", detail: team.shooter2Detail }].map(({ label, detail }) => detail?.series.length ? <div key={label} className="flex flex-col gap-0.5"><span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">{label}</span><div className="flex gap-2 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">{detail.series.map((value, seriesIndex) => <span key={seriesIndex} className={value === Math.max(...detail.series) ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>{fmt(value)}</span>)}</div></div> : null)}</div></motion.div>}</AnimatePresence>
        </div>;
      })}
    </div></div>
  </div>;
}
