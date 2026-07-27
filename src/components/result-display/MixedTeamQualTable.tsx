"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { displayNoc } from "@/lib/noc-list";
import { RemarkBadge, RemarkLegend, assignRemarkCodes, type RemarkLegendItem } from "./RemarkBadge";

export type MixedTeamRow = {
  id: number; nocCode: string; teamNumber: number; shooter1Id: number | null; shooter2Id: number | null;
  shooter1Name: string | null; shooter2Name: string | null;
  shooter1Detail: { series: number[]; inners?: number | null; total: number } | null; shooter2Detail: { series: number[]; inners?: number | null; total: number } | null;
  shooter1FinalDetail?: { series: number[] } | null; shooter2FinalDetail?: { series: number[] } | null;
  qualRank: number | null; qualTotal: string | null; qualInners: number | null; qualRemark: string | null; qualified: boolean | null; finalRank: number | null; finalTotal: string | null; finalRemark: string | null;
};

interface Props { teams: MixedTeamRow[]; apparatus: string | null; stage?: "qual" | "final"; }

const MEDAL_COLOR: Record<number, string> = {
  1: "oklch(0.75 0.14 85)",
  2: "oklch(0.75 0.01 85)",
  3: "oklch(0.60 0.10 55)",
};

function MedalIcon({ rank }: { rank: number }) {
  const color = MEDAL_COLOR[rank];
  if (!color) return null;
  return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.65rem] font-bold text-white shrink-0" style={{ background: color }} aria-label={`Mesto ${rank}`}>{rank}</span>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-[var(--subtle)]" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 180ms ease" }}><path d="M2.5 5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function TeamMember({ id, name, total, inners, showInners, fmt }: { id: number | null; name: string | null; total: number | null; inners: number | null | undefined; showInners: boolean; fmt: (value: number) => string }) {
  // Sum moved to its own column after the series on desktop — kept inline here only for mobile, which has no series columns.
  const content = <><span className="truncate">{name ?? "—"}</span>{total != null && <span className="ml-auto flex shrink-0 items-baseline gap-1 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold tabular-nums text-[var(--ink)] sm:hidden">{fmt(total)}{showInners && inners != null && <span className="font-normal text-[var(--muted)]">{inners}<span className="text-[0.6rem]">×</span></span>}</span>}</>;
  return id ? <Link href={`/strelci/${id}`} onClick={(event) => event.stopPropagation()} className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--ink)] transition-colors hover:text-[var(--brand-primary)]">{content}</Link> : <span className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--ink)]">{content}</span>;
}

function sumOrNull(series: number[] | undefined): number | null {
  return series && series.length ? series.reduce((a, b) => a + b, 0) : null;
}

export function MixedTeamQualTable({ teams, apparatus, stage = "qual" }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();
  const isFinal = stage === "final";
  const rank = (team: MixedTeamRow) => isFinal ? team.finalRank : team.qualRank;
  const total = (team: MixedTeamRow) => isFinal ? team.finalTotal : team.qualTotal;
  const remark = (team: MixedTeamRow) => isFinal ? team.finalRemark : team.qualRemark;
  const detail1 = (team: MixedTeamRow) => isFinal ? team.shooter1FinalDetail ?? null : team.shooter1Detail;
  const detail2 = (team: MixedTeamRow) => isFinal ? team.shooter2FinalDetail ?? null : team.shooter2Detail;
  const shooterTotal1 = (team: MixedTeamRow) => isFinal ? sumOrNull(detail1(team)?.series) : (team.shooter1Detail?.total ?? null);
  const shooterTotal2 = (team: MixedTeamRow) => isFinal ? sumOrNull(detail2(team)?.series) : (team.shooter2Detail?.total ?? null);
  const fmt = (value: number) => (isFinal || apparatus === "air_rifle" ? value.toFixed(1) : Math.round(value).toString());
  const sorted = teams.filter((team) => !isFinal || total(team) != null || rank(team) != null).toSorted((a, b) => (rank(a) ?? Infinity) - (rank(b) ?? Infinity));
  const remarkCodes = assignRemarkCodes(sorted.map(remark));
  const remarkLegend: RemarkLegendItem[] = sorted
    .map((team, idx) => (remarkCodes[idx] ? { code: remarkCodes[idx]!, remark: remark(team)!, label: `${team.shooter1Name ?? ""} / ${team.shooter2Name ?? ""}` } : null))
    .filter((item): item is RemarkLegendItem => item != null);
  const showInners = !isFinal && sorted.some((team) => team.qualInners != null || team.shooter1Detail?.inners != null || team.shooter2Detail?.inners != null);
  const hasSeries = sorted.some((team) => (detail1(team)?.series.length ?? 0) > 0 || (detail2(team)?.series.length ?? 0) > 0);
  const allExpanded = hasSeries && sorted.every((team) => expanded.has(team.id));
  const seriesLen = hasSeries ? Math.max(0, ...sorted.flatMap((team) => [detail1(team)?.series.length ?? 0, detail2(team)?.series.length ?? 0])) : 0;
  const seriesHeaders = Array.from({ length: seriesLen }, (_, i) => `S${i + 1}`);
  const SERIES_COL_W = "64px";
  const mobileColumns = ["32px", "0px", "minmax(70px, 100px)", "minmax(150px, 1fr)", "72px", "24px", hasSeries ? "18px" : ""].filter(Boolean).join(" ");
  const desktopColumns = ["32px", "minmax(90px, 200px)", "80px", "minmax(120px, 180px)", ...seriesHeaders.map(() => SERIES_COL_W), "minmax(56px, 140px)", "minmax(72px, 1fr)", "40px"].join(" ");
  const header = "flex items-center border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-3";

  if (!sorted.length) return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center"><p className="text-sm text-[var(--muted)]">{isFinal ? "Nema finalnih rezultata." : "Nema rezultata za ovu disciplinu."}</p></div>;
  const toggle = (id: number) => setExpanded((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return <div className="overflow-hidden rounded-xl border border-[var(--border)]">
    {hasSeries && <div className="flex items-center justify-end border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:hidden"><button type="button" onClick={() => setExpanded(allExpanded ? new Set() : new Set(sorted.map((team) => team.id)))} className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)] transition-colors hover:text-[var(--ink)]">{allExpanded ? "Sakrij serije" : "Prikaži sve serije"}<ChevronIcon open={allExpanded} /></button></div>}
    <div><div role="table" className="grid text-sm [grid-template-columns:var(--mobile-grid)] sm:[grid-template-columns:var(--desktop-grid)]" style={{ "--mobile-grid": mobileColumns, "--desktop-grid": desktopColumns } as CSSProperties}>
      <div role="row" style={{ display: "contents" }}>
        <div role="columnheader" className={`${header} justify-end`}>#</div>
        <div role="columnheader" className={header}>Tim</div>
        <div role="columnheader" className={header}>NOC</div>
        <div role="columnheader" className={header}>Strelci</div>
        {hasSeries && seriesHeaders.map((h, i) => <div key={i} role="columnheader" className={`hidden sm:flex ${header} justify-end`}>{h}</div>)}
        <div role="columnheader" className={`hidden sm:flex ${header} justify-end`} aria-hidden="true" />
        <div role="columnheader" className={`${header} justify-end`}>Σ</div>
        <div role="columnheader" className={header} aria-hidden="true" />
        {hasSeries && <div role="columnheader" className={`${header} sm:hidden`} aria-hidden="true" />}
      </div>
      {sorted.map((team, index) => {
        const teamRank = rank(team); const isExpanded = expanded.has(team.id); const isLast = index === sorted.length - 1; const rowBg = index % 2 ? "var(--surface)" : "var(--bg)";
        // Explicit row placement — with two sub-rows per team sharing spanning cells, CSS
        // Grid's implicit auto-flow can misplace items once column count changes; pin it down.
        const r1 = 2 + index * 3; const r2 = r1 + 1; const accordionRow = r1 + 2;
        const cell = `flex items-center px-2 py-2.5 text-sm transition-colors sm:px-3 ${!isLast || isExpanded ? "border-b border-[var(--border)]" : ""}`;
        const memberCell = `flex min-w-0 items-center px-2 py-1.5 text-sm transition-colors sm:px-3`;
        const noc = displayNoc(team.nocCode); const nocEntry = NOC_LIST.find((country) => country.noc === noc); const alpha2 = nocEntry?.alpha2;
        const subtotalCell = `hidden sm:flex ${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)] group-hover:bg-[var(--surface-2)]`;
        return <div key={team.id} role="rowgroup" style={{ display: "contents" }}>
          <div role="row" className={`group ${hasSeries ? "cursor-pointer sm:cursor-default" : ""}`} style={{ display: "contents" }} onClick={hasSeries ? () => toggle(team.id) : undefined}>
            <div className={`${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>{teamRank == null ? <span className="text-[var(--subtle)]">—</span> : isFinal && teamRank <= 3 ? <span className="flex w-full justify-center"><MedalIcon rank={teamRank} /></span> : <span className={teamRank <= 3 && !isFinal ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}>{teamRank}</span>}</div>
            <div className={`${cell} min-w-0 group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>
              <span className="hidden sm:inline min-w-0 truncate text-sm text-[var(--ink)]">{nocEntry?.name && noc !== "AIN" ? nocEntry.name : noc} {team.teamNumber}</span>
            </div>
            <div className={`${cell} group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>
              <span className="flex shrink-0 items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold text-[var(--ink)]">{alpha2 && <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block" }} />}{noc} <span className="text-[var(--subtle)]">{team.teamNumber}</span></span>
            </div>
            <div className={`${memberCell} group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r1, background: rowBg }}><TeamMember id={team.shooter1Id} name={team.shooter1Name} total={team.shooter1Detail?.total ?? null} inners={team.shooter1Detail?.inners} showInners={showInners} fmt={fmt} /></div>
            {hasSeries && seriesHeaders.map((_, i) => { const s1 = detail1(team)?.series; const v = s1?.[i]; return <div key={i} className={`hidden sm:flex ${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r1, background: rowBg }}>{v != null ? <span className={!isFinal && v === Math.max(...(s1 ?? [])) ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>{fmt(v)}</span> : !isFinal ? <span className="text-[var(--subtle)]">—</span> : null}</div>; })}
            <div className={subtotalCell} style={{ gridRow: r1, background: rowBg }}>{shooterTotal1(team) != null ? fmt(shooterTotal1(team)!) : <span className="text-[var(--subtle)]">—</span>}</div>
            <div className={`${cell} justify-end gap-1 font-[family-name:var(--font-jetbrains-mono)] text-lg font-bold tabular-nums text-[var(--ink)] group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>{total(team) != null ? <>{fmt(Number(total(team)))}{showInners && team.qualInners != null && <span className="text-xs font-normal text-[var(--muted)]">{team.qualInners}<span className="text-[0.6rem]">×</span></span>}</> : <span className="font-normal text-[var(--subtle)]">—</span>}</div>
            <div className={`${cell} justify-end pr-4 font-[family-name:var(--font-jetbrains-mono)] text-base font-bold text-[var(--success)] group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>{remark(team) ? <RemarkBadge remark={remark(team)!} code={remarkCodes[index]} label={`${team.shooter1Name ?? ""} / ${team.shooter2Name ?? ""}`} className="" /> : !isFinal && team.qualified ? "Q" : null}</div>
            {hasSeries && <div className={`${cell} justify-center group-hover:bg-[var(--surface-2)] sm:hidden`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}><ChevronIcon open={isExpanded} /></div>}
            <div className={`${memberCell} ${!isLast || isExpanded ? "border-b border-[var(--border)]" : ""} group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r2, background: rowBg }}><TeamMember id={team.shooter2Id} name={team.shooter2Name} total={team.shooter2Detail?.total ?? null} inners={team.shooter2Detail?.inners} showInners={showInners} fmt={fmt} /></div>
            {hasSeries && seriesHeaders.map((_, i) => { const s2 = detail2(team)?.series; const v = s2?.[i]; return <div key={i} className={`hidden sm:flex ${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r2, background: rowBg }}>{v != null ? <span className={!isFinal && v === Math.max(...(s2 ?? [])) ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>{fmt(v)}</span> : !isFinal ? <span className="text-[var(--subtle)]">—</span> : null}</div>; })}
            <div className={subtotalCell} style={{ gridRow: r2, background: rowBg }}>{shooterTotal2(team) != null ? fmt(shooterTotal2(team)!) : <span className="text-[var(--subtle)]">—</span>}</div>
          </div>
          <AnimatePresence initial={false}>{hasSeries && isExpanded && <motion.div role="row" initial={reducedMotion ? false : { height: 0, opacity: 0, y: -4 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} style={{ gridColumn: "1 / -1", gridRow: accordionRow, background: rowBg }} className={`min-h-0 overflow-hidden px-3 sm:hidden ${isLast ? "" : "border-b border-[var(--border)]"}`}><div className="flex flex-col gap-1.5 py-2">{[{ name: team.shooter1Name, detail: detail1(team) }, { name: team.shooter2Name, detail: detail2(team) }].map(({ name, detail }) => detail?.series.length ? <div key={name} className="flex min-w-0 items-center gap-3"><span className="w-24 shrink-0 truncate text-xs font-semibold text-[var(--ink)]">{name?.split(/\s+/)[0] ?? "—"}</span><div className="flex gap-2 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">{detail.series.map((value, seriesIndex) => <span key={seriesIndex} className={!isFinal && value === Math.max(...detail.series) ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>{fmt(value)}</span>)}</div></div> : null)}</div></motion.div>}</AnimatePresence>
        </div>;
      })}
    </div></div>
    <RemarkLegend items={remarkLegend} />
  </div>;
}
