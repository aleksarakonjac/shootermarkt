"use client";

import { Fragment, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { NOC_LIST } from "@/components/ui/NocDropdown";
import { splitDisplayName } from "@shootermarkt/adapters/sius/public-adapter";
import { displayNoc } from "@shootermarkt/db/noc-list";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { NocChip, SheetCells, SheetFrame, SheetStats } from "./ResultSheet";
import { ShooterAvatar } from "./ShooterAvatar";
import { QualifiedBadge, SeriesBox, seriesGridStyle } from "./CompetitionQualTable";
import { RemarkBadge, RemarkLegend, assignRemarkCodes, remarkLabel, remarkText, type RemarkLegendItem } from "./RemarkBadge";
import { useRowFlash } from "./useRowFlash";
import { isUnrankedRemark, type RemarkDetails } from "@shootermarkt/db/pdf-import-types";

export type MixedTeamRow = {
  id: number; nocCode: string; teamNumber: number; shooter1Id: number | null; shooter2Id: number | null;
  shooter1Name: string | null; shooter2Name: string | null;
  shooter1AvatarUrl?: string | null; shooter2AvatarUrl?: string | null; shooter1BirthYear?: number | null; shooter2BirthYear?: number | null;
  shooter1Detail: { series: number[]; inners?: number | null; total: number } | null; shooter2Detail: { series: number[]; inners?: number | null; total: number } | null;
  shooter1FinalDetail?: { series: number[] } | null; shooter2FinalDetail?: { series: number[] } | null;
  qualRank: number | null; qualTotal: string | null; qualInners: number | null; qualRemark: string | null; qualified: boolean | null; finalRank: number | null; finalTotal: string | null; finalRemark: string | null; remarkDetails?: RemarkDetails | null;
};

const STATUS_MARKS = new Set(["DSQ", "DNS", "DNF", "RPO"]);

// showMedals: false dok finale traje — prva tri mesta bez medalja.
interface Props { teams: MixedTeamRow[]; apparatus: string | null; stage?: "qual" | "final"; showMedals?: boolean; }

const MEDAL_COLOR: Record<number, string> = {
  1: "oklch(0.75 0.14 85)",
  2: "oklch(0.75 0.01 85)",
  3: "oklch(0.60 0.10 55)",
};

function MedalIcon({ rank }: { rank: number }) {
  const en = useLocale() === "en";
  const color = MEDAL_COLOR[rank];
  if (!color) return null;
  return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[0.65rem] font-bold text-white shrink-0" style={{ background: color }} aria-label={`${en ? "Place" : "Mesto"} ${rank}`}>{rank}</span>;
}

function ChevronIcon({ open }: { open: boolean }) {
  return <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0 text-[var(--subtle)]" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 180ms ease" }}><path d="M2.5 5l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function TeamMember({ id, name, onOpen }: { id: number | null; name: string | null; onOpen?: () => void }) {
  // Prezime istaknuto, ime tanje i prigušeno — kao u pojedinačnim rezultatima. Prezime se ne skraćuje zarad imena: kad nema mesta, skraćuje se ime.
  const { lastName, firstName } = name ? splitDisplayName(name) : { lastName: "—", firstName: "" };
  const content = <><span className="max-w-full shrink-0 truncate font-medium text-[var(--ink)] transition-colors group-hover/name:text-[var(--brand-primary)]">{lastName}</span>{firstName && <span className="min-w-0 truncate text-[var(--muted)]">{firstName}</span>}</>;
  const cls = "group/name flex min-w-0 items-baseline gap-1.5";
  return id ? <Link href={`/strelci/${id}`} onClick={(event) => { event.stopPropagation(); if (onOpen && window.matchMedia("(max-width: 639px)").matches) { event.preventDefault(); onOpen(); } }} className={cls}>{content}</Link> : <span className={cls}>{content}</span>;
}

/** Finala do 2025: Gold/Bronze Medal Match na poene (do 16–17), ne zbir krugova — ukupno je broj poena meča. */
export function isMatchFormat(teams: Pick<MixedTeamRow, "finalTotal">[]): boolean {
  const totals = teams.flatMap((team) => (team.finalTotal != null ? [Number(team.finalTotal)] : []));
  return totals.length > 0 && totals.every((total) => total <= 30);
}

/** Zlatni meč igraju 1. i 2. mesto, bronzani 3. i 4. */
export function matchTeams(teams: MixedTeamRow[], medal: "gold" | "bronze"): MixedTeamRow[] {
  const places = medal === "gold" ? [1, 2] : [3, 4];
  return teams.filter((team) => team.finalRank != null && places.includes(team.finalRank));
}

/** Meč: runde su kolone (hitac strelca 1, strelac 2, zbir tima); boldovane su runde koje su donele poene (pobeda ili nerešeno). */
function MatchRoundsGrid({ rows, sums, won, fmt }: { rows: Array<{ name: string | null; shots: number[] }>; sums: Array<number | null>; won: boolean[]; fmt: (value: number) => string }) {
  const cell = "text-center font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums";
  const tone = (round: number) => (won[round] ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]");
  return <div className="overflow-x-auto py-2"><div className="inline-grid items-center gap-x-1 gap-y-1" style={{ gridTemplateColumns: `5.5rem repeat(${sums.length}, 2.75rem)` }}>
    <span />{sums.map((_, round) => <span key={round} className={`${cell} text-[0.6rem] text-[var(--subtle)]`}>{round + 1}</span>)}
    {rows.map(({ name, shots }, row) => <Fragment key={row}><span className="truncate pr-2 text-xs font-semibold text-[var(--ink)]">{name?.split(/\s+/)[0] ?? "—"}</span>{sums.map((_, round) => <span key={round} className={`${cell} ${tone(round)}`}>{shots[round] != null ? fmt(shots[round]) : "—"}</span>)}</Fragment>)}
    <span className="border-t border-[var(--border)] pt-1 text-xs font-semibold text-[var(--muted)]">Σ</span>{sums.map((sum, round) => <span key={round} className={`${cell} border-t border-[var(--border)] pt-1 ${tone(round)}`}>{sum != null ? fmt(sum) : "—"}</span>)}
  </div></div>;
}

function sumOrNull(series: number[] | undefined): number | null {
  return series && series.length ? series.reduce((a, b) => a + b, 0) : null;
}

export function MixedTeamQualTable({ teams, apparatus, stage = "qual", showMedals = true }: Props) {
  const en = useLocale() === "en";
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();
  const [sheetId, setSheetId] = useState<number | null>(null);
  const isFinal = stage === "final";
  const rank = (team: MixedTeamRow) => isFinal ? team.finalRank : team.qualRank;
  const total = (team: MixedTeamRow) => isFinal ? team.finalTotal : team.qualTotal;
  const remark = (team: MixedTeamRow) => isFinal ? team.finalRemark : team.qualRemark;
  const stageDetails = (team: MixedTeamRow) => (isFinal ? team.remarkDetails?.final : team.remarkDetails?.qual) ?? null;
  const detail1 = (team: MixedTeamRow) => isFinal ? team.shooter1FinalDetail ?? null : team.shooter1Detail;
  const detail2 = (team: MixedTeamRow) => isFinal ? team.shooter2FinalDetail ?? null : team.shooter2Detail;
  const shooterTotal1 = (team: MixedTeamRow) => isFinal ? sumOrNull(detail1(team)?.series) : (team.shooter1Detail?.total ?? null);
  const shooterTotal2 = (team: MixedTeamRow) => isFinal ? sumOrNull(detail2(team)?.series) : (team.shooter2Detail?.total ?? null);
  const fmt = (value: number) => (isFinal || apparatus === "air_rifle" ? value.toFixed(1) : Math.round(value).toString());
  const isUnranked = (team: MixedTeamRow) => { return isUnrankedRemark(remark(team)); };
  const sorted = teams.filter((team) => !isFinal || total(team) != null || rank(team) != null || remark(team) != null).toSorted((a, b) => Number(isUnranked(a)) - Number(isUnranked(b)) || (rank(a) ?? Infinity) - (rank(b) ?? Infinity));
  const flashing = useRowFlash(sorted.map((team) => [team.id, `${total(team)}|${rank(team)}|${remark(team)}|${JSON.stringify([detail1(team), detail2(team)])}`] as const));
  const isMatch = isFinal && isMatchFormat(sorted);
  // Zlatni meč igraju 1. i 2. mesto, bronzani 3. i 4. — protivnik je drugi tim iz para.
  const opponentOf = (team: MixedTeamRow) => (team.finalRank == null ? undefined : sorted.find((other) => other.finalRank === (team.finalRank! % 2 ? team.finalRank! + 1 : team.finalRank! - 1)));
  // Po rundi: zbir hitaca oba strelca tima; veći zbir nosi poene (2), jednaki zbirovi po 1 poen (oba tima).
  const teamRoundSums = (team: MixedTeamRow) => (detail1(team)?.series ?? []).map((shot, i) => { const second = detail2(team)?.series[i]; return second == null ? null : Math.round((shot + second) * 10) / 10; });
  const roundOutcomes = (team: MixedTeamRow) => {
    const own = teamRoundSums(team);
    const opponent = opponentOf(team);
    const theirs = opponent ? teamRoundSums(opponent) : [];
    return { sums: own, won: own.map((sum, i) => sum != null && theirs[i] != null && sum >= theirs[i]!) };
  };
  const remarkCodes = assignRemarkCodes(sorted.map((team) => remarkText(remark(team), stageDetails(team))));
  const remarkLegend: RemarkLegendItem[] = sorted
    .map((team, idx) => (remarkCodes[idx] ? { code: remarkCodes[idx]!, remark: remarkText(remark(team), stageDetails(team))!, label: `${team.shooter1Name ?? ""} / ${team.shooter2Name ?? ""}` } : null))
    .filter((item): item is RemarkLegendItem => item != null);
  const showInners = !isFinal && sorted.some((team) => team.qualInners != null || team.shooter1Detail?.inners != null || team.shooter2Detail?.inners != null);
  const hasSeries = sorted.some((team) => (detail1(team)?.series.length ?? 0) > 0 || (detail2(team)?.series.length ?? 0) > 0);
  const allExpanded = hasSeries && sorted.every((team) => expanded.has(team.id));
  const seriesLen = hasSeries ? Math.max(0, ...sorted.flatMap((team) => [detail1(team)?.series.length ?? 0, detail2(team)?.series.length ?? 0])) : 0;
  // Meč ima 12–16 hitaca po strelcu — ne staju u kolone, pa se prikazuju u proširenom redu (na svim širinama).
  const seriesHeaders = isMatch ? [] : Array.from({ length: seriesLen }, (_, i) => `S${i + 1}`);
  const SERIES_COL_W = "64px";
  const mobileColumns = ["40px", "0px", "minmax(56px, 72px)", "minmax(0, 1fr)", "44px", "60px", "minmax(20px, max-content)", hasSeries ? "16px" : ""].filter(Boolean).join(" ");
  // Imena strelaca dobijaju slobodan prostor (ne kolona ukupnog), da serije budu odmah uz NOC/imena.
  const desktopColumns = ["32px", "fit-content(200px)", "72px", "minmax(220px, 1fr)", ...seriesHeaders.map(() => SERIES_COL_W), "72px", "max-content", "minmax(28px, max-content)", "28px"].join(" ");
  const header = "flex items-center border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-3";

  if (!sorted.length) return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center"><p className="text-sm text-[var(--muted)]">{isFinal ? (en ? "No final results." : "Nema finalnih rezultata.") : (en ? "No results for this event." : "Nema rezultata za ovu disciplinu.")}</p></div>;
  const toggle = (id: number) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <div className="overflow-hidden rounded-xl border border-[var(--border)]">
    {hasSeries && <div className={`flex items-center justify-end border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 ${isMatch ? "" : "sm:hidden"}`}><button type="button" onClick={() => setExpanded(allExpanded ? new Set() : new Set(sorted.map((team) => team.id)))} className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)] transition-colors hover:text-[var(--ink)]">{allExpanded ? (en ? "Hide series" : "Sakrij serije") : (en ? "Show all series" : "Prikaži sve serije")}<ChevronIcon open={allExpanded} /></button></div>}
    <div><div role="table" className="grid text-sm [grid-template-columns:var(--mobile-grid)] sm:[grid-template-columns:var(--desktop-grid)]" style={{ "--mobile-grid": mobileColumns, "--desktop-grid": desktopColumns } as CSSProperties}>
      <div role="row" style={{ display: "contents" }}>
        <div role="columnheader" className={`${header} justify-end`}>#</div>
        <div role="columnheader" className={header}>{en ? "Team" : "Tim"}</div>
        <div role="columnheader" className={header}>NOC</div>
        <div role="columnheader" className={header}>{en ? "Shooters" : "Strelci"}</div>
        {hasSeries && seriesHeaders.map((h, i) => <div key={i} role="columnheader" className={`hidden sm:flex ${header} justify-end`}>{h}</div>)}
        <div role="columnheader" className={`${header} justify-end`} aria-hidden="true" />
        <div role="columnheader" className={`${header} justify-end`}>Σ</div>
        <div role="columnheader" className={header} aria-hidden="true" />
        <div role="columnheader" className={`hidden sm:flex ${header}`} aria-hidden="true" />
        {hasSeries && <div role="columnheader" className={`${header} sm:hidden`} aria-hidden="true" />}
      </div>
      {sorted.map((team, index) => {
        const teamRank = isUnranked(team) ? null : rank(team); const isExpanded = expanded.has(team.id); const isLast = index === sorted.length - 1; const rowBg = index % 2 ? "var(--surface)" : "var(--bg)";
        // Explicit row placement — with two sub-rows per team sharing spanning cells, CSS
        // Grid's implicit auto-flow can misplace items once column count changes; pin it down.
        const r1 = 2 + index * 3; const r2 = r1 + 1; const accordionRow = r1 + 2;
        const cell = `flex items-center px-2 py-2.5 text-sm transition-colors sm:px-3 ${!isLast || isExpanded ? "border-b border-[var(--border)]" : ""}`;
        const memberCell = `flex min-w-0 items-center px-2 py-1.5 text-sm transition-colors sm:px-3`;
        const rounds = isMatch ? roundOutcomes(team) : null; const noc = displayNoc(team.nocCode); const nocEntry = NOC_LIST.find((country) => country.noc === noc); const alpha2 = nocEntry?.alpha2;
        // DSQ/DNS/DNF/RPO idu uz ukupan zbir: bez zbira (0.0 ne nosi informaciju) zamenjuju ga, a sa zbirom stoje kao mali label iznad.
        const status = remark(team) && STATUS_MARKS.has(remark(team)!) ? remark(team)! : null;
        const hasTotal = total(team) != null && Number(total(team)) > 0;
        const statusBadge = (className: string) => <RemarkBadge remark={status!} code={remarkCodes[index]} details={stageDetails(team)} label={`${team.shooter1Name ?? ""} / ${team.shooter2Name ?? ""}`} className={className} />;
        const subtotalCell =`flex ${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums text-[var(--ink)] group-hover:bg-[var(--surface-2)]`;
        return <div key={team.id} role="rowgroup" style={{ display: "contents" }}>
          <div role="row" className={`group ${hasSeries ? (isMatch ? "cursor-pointer" : "cursor-pointer sm:cursor-default") : ""} ${flashing.has(team.id) ? "result-row-flash" : ""}`} style={{ display: "contents" }} onClick={hasSeries ? () => toggle(team.id) : undefined}>
            <div className={`${cell} max-sm:!px-1.5 justify-end font-[family-name:var(--font-jetbrains-mono)] tabular-nums group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>{teamRank == null ? <span className="text-[var(--subtle)]">—</span> : isFinal && showMedals && teamRank <= 3 ? <span className="flex w-full justify-center"><MedalIcon rank={teamRank} /></span> : <span className={teamRank <= 3 && !isFinal ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}>{teamRank}</span>}</div>
            <div className={`${cell} min-w-0 group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>
              <span className="hidden sm:inline min-w-0 truncate text-sm text-[var(--ink)]">{nocEntry?.name && noc !== "AIN" ? nocEntry.name : noc} {team.teamNumber}</span>
            </div>
            <div className={`${cell} group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>
              <button type="button" onClick={(event) => { event.stopPropagation(); setSheetId(team.id); }} aria-label={`${en ? "Details" : "Detalji"}: ${noc} ${team.teamNumber}`} className="flex min-h-11 items-center sm:hidden"><span className="flex shrink-0 items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold text-[var(--ink)]">{alpha2 && <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block" }} />}{noc} <span className="text-[var(--subtle)]">{team.teamNumber}</span></span></button>
              <span className="hidden shrink-0 items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold text-[var(--ink)] sm:flex">{alpha2 && <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block" }} />}{noc} <span className="text-[var(--subtle)]">{team.teamNumber}</span></span>
            </div>
            <div className={`${memberCell} group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r1, background: rowBg }}><TeamMember id={team.shooter1Id} name={team.shooter1Name} onOpen={() => setSheetId(team.id)} /></div>
            {hasSeries && seriesHeaders.map((_, i) => { const s1 = detail1(team)?.series; const v = s1?.[i]; return <div key={i} className={`hidden sm:flex ${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r1, background: rowBg }}>{v != null ? <span className={!isFinal && v === Math.max(...(s1 ?? [])) ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>{fmt(v)}</span> : !isFinal ? <span className="text-[var(--subtle)]">—</span> : null}</div>; })}
            <div className={subtotalCell} style={{ gridRow: r1, background: rowBg }}>{shooterTotal1(team) != null ? fmt(shooterTotal1(team)!) : <span className="text-[var(--subtle)]">—</span>}</div>
            <div className={`${cell} justify-end gap-1 font-[family-name:var(--font-jetbrains-mono)] text-lg font-bold tabular-nums text-[var(--ink)] group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>{status && !hasTotal ? statusBadge("") : <span className="flex flex-col items-end leading-tight">{status && statusBadge("!text-[0.6rem] !leading-none mb-0.5")}<span className="flex items-center gap-1">{total(team) != null ? <>{isMatch ? Math.round(Number(total(team))) : fmt(Number(total(team)))}{showInners && team.qualInners != null && <span className="text-xs font-normal text-[var(--muted)]">{team.qualInners}<span className="text-[0.6rem]">×</span></span>}</> : <span className="font-normal text-[var(--subtle)]">—</span>}</span></span>}</div>
            <div className={`${cell} justify-start !pl-1.5 !pr-2 sm:!pl-2 sm:!pr-3 font-[family-name:var(--font-jetbrains-mono)] text-base font-bold text-[var(--success)] group-hover:bg-[var(--surface-2)]`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>{status ? null : remark(team) ? <RemarkBadge remark={remark(team)!} code={remarkCodes[index]} details={stageDetails(team)} label={`${team.shooter1Name ?? ""} / ${team.shooter2Name ?? ""}`} className="" /> : <span className="flex items-center gap-1.5">{!isFinal && team.qualified ? "Q" : null}{remarkLabel(null, stageDetails(team), remarkCodes[index]) && <RemarkBadge remark={remarkLabel(null, stageDetails(team), remarkCodes[index])!} code={remarkCodes[index]} details={stageDetails(team)} label={`${team.shooter1Name ?? ""} / ${team.shooter2Name ?? ""}`} className="" />}</span>}</div>
            <div className={`${cell} hidden justify-center !px-0.5 group-hover:bg-[var(--surface-2)] sm:flex`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}>{isMatch && hasSeries && <ChevronIcon open={isExpanded} />}</div>
            {hasSeries && <div className={`${cell} justify-center group-hover:bg-[var(--surface-2)] sm:hidden`} style={{ gridRow: `${r1} / span 2`, background: rowBg }}><ChevronIcon open={isExpanded} /></div>}
            <div className={`${memberCell} ${!isLast || isExpanded ? "border-b border-[var(--border)]" : ""} group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r2, background: rowBg }}><TeamMember id={team.shooter2Id} name={team.shooter2Name} onOpen={() => setSheetId(team.id)} /></div>
            {hasSeries && seriesHeaders.map((_, i) => { const s2 = detail2(team)?.series; const v = s2?.[i]; return <div key={i} className={`hidden sm:flex ${cell} justify-end font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums group-hover:bg-[var(--surface-2)]`} style={{ gridRow: r2, background: rowBg }}>{v != null ? <span className={!isFinal && v === Math.max(...(s2 ?? [])) ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}>{fmt(v)}</span> : !isFinal ? <span className="text-[var(--subtle)]">—</span> : null}</div>; })}
            <div className={subtotalCell} style={{ gridRow: r2, background: rowBg }}>{shooterTotal2(team) != null ? fmt(shooterTotal2(team)!) : <span className="text-[var(--subtle)]">—</span>}</div>
          </div>
          <AnimatePresence initial={false}>{hasSeries && isExpanded && <motion.div role="row" initial={reducedMotion ? false : { height: 0, opacity: 0, y: -4 }} animate={{ height: "auto", opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }} style={{ gridColumn: "1 / -1", gridRow: accordionRow, background: rowBg }} className={`min-h-0 overflow-hidden px-3 ${isMatch ? "" : "sm:hidden"} ${isLast ? "" : "border-b border-[var(--border)]"}`}>{rounds ? <MatchRoundsGrid rows={[{ name: team.shooter1Name, shots: detail1(team)?.series ?? [] }, { name: team.shooter2Name, shots: detail2(team)?.series ?? [] }]} sums={rounds.sums} won={rounds.won} fmt={fmt} /> : <div className="flex flex-col gap-2 py-2.5">{[{ name: team.shooter1Name, detail: detail1(team) }, { name: team.shooter2Name, detail: detail2(team) }].map(({ name, detail }, memberIndex) => detail?.series.length ? <div key={memberIndex} className="flex min-w-0 flex-col gap-1"><span className="truncate text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]">{name ?? "—"}</span><div className="grid gap-1.5" style={seriesGridStyle(seriesLen)}>{detail.series.map((value, seriesIndex) => <SeriesBox key={seriesIndex} text={fmt(value)} best={!isFinal && value === Math.max(...detail.series)} onSurface={index % 2 === 1} />)}</div></div> : null)}</div>}</motion.div>}</AnimatePresence>
        </div>;
      })}
    </div></div>
    <RemarkLegend items={remarkLegend} />
    {(() => {
      const si = sheetId == null ? -1 : sorted.findIndex((t) => t.id === sheetId);
      const st = si >= 0 ? sorted[si] : null;
      if (!st) return <BottomSheet open={false} onClose={() => setSheetId(null)} label="">{null}</BottomSheet>;
      const stNoc = displayNoc(st.nocCode); const stCountry = NOC_LIST.find((c) => c.noc === stNoc)?.name; const title = `${stCountry && stNoc !== "AIN" ? stCountry : stNoc} ${st.teamNumber}`;
      const stRank = isUnranked(st) ? null : rank(st); const stMark = remark(st) ?? remarkLabel(null, stageDetails(st), remarkCodes[si]);
      const stRounds = isMatch ? roundOutcomes(st) : null; const label = `${st.shooter1Name ?? ""} / ${st.shooter2Name ?? ""}`;
      const members = [
        { id: st.shooter1Id, name: st.shooter1Name, avatar: st.shooter1AvatarUrl, birthYear: st.shooter1BirthYear, detail: detail1(st), total: shooterTotal1(st), inners: st.shooter1Detail?.inners },
        { id: st.shooter2Id, name: st.shooter2Name, avatar: st.shooter2AvatarUrl, birthYear: st.shooter2BirthYear, detail: detail2(st), total: shooterTotal2(st), inners: st.shooter2Detail?.inners },
      ];
      const qualified = !isFinal && st.qualified === true;
      const marks = (
        <span className="flex flex-wrap items-center justify-center gap-x-2">
          {qualified && <QualifiedBadge size="lg" />}
          {stMark ? <RemarkBadge size="lg" remark={stMark} code={remarkCodes[si]} details={stageDetails(st)} label={label} className="" /> : !qualified && "—"}
        </span>
      );
      return (
        <BottomSheet open onClose={() => setSheetId(null)} label={title}>
          <SheetFrame en={en} onPrev={si > 0 ? () => setSheetId(sorted[si - 1].id) : undefined} onNext={si < sorted.length - 1 ? () => setSheetId(sorted[si + 1].id) : undefined}>
            <div className="pr-10">
              <h2 aria-live="polite" className="text-xl font-semibold leading-tight text-[var(--ink)] break-words">{title}</h2>
              <p className="mt-1 flex items-center gap-2 text-base text-[var(--muted)]"><NocChip nationality={st.nocCode} /></p>
            </div>
            <SheetStats items={[
              { label: en ? "Rank" : "Mesto", value: stRank ?? "—" },
              { label: en ? "Total" : "Ukupno", value: total(st) != null ? (isMatch ? Math.round(Number(total(st))) : fmt(Number(total(st)))) : "—" },
              showInners ? { label: en ? "Inner 10s" : "Desetke", value: st.qualInners ?? "—" } : { label: en ? "Remark" : "Napomena", value: marks },
            ]} />
            {showInners && (qualified || stMark) && <div className="mt-3 flex justify-center">{marks}</div>}
            {members.map((m, mi) => {
              const series = m.detail?.series ?? [];
              const best = !isFinal && series.length ? Math.max(...series) : null;
              const person = m.name ? splitDisplayName(m.name) : { lastName: "—", firstName: "" };
              const cells = [
                ...series.map((v, i) => ({ label: isMatch ? `R${i + 1}` : `S${i + 1}`, main: fmt(v), best: best != null && v === best })),
                ...(m.total != null ? [{ label: "Σ", main: fmt(m.total), sub: m.inners != null ? `${m.inners}×` : undefined, best: true }] : []),
              ];
              return (
                <div key={mi} className="mt-6">
                  <div className="flex items-center gap-3">
                    <ShooterAvatar firstName={person.firstName} lastName={person.lastName} avatarUrl={m.avatar} size="md" />
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight text-[var(--ink)] break-words">{person.lastName} {person.firstName}{m.birthYear != null && <span className="ml-2 text-base font-normal text-[var(--muted)]">{m.birthYear}</span>}</h3>
                      {m.id && (
                        <Link href={`/strelci/${m.id}`} className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-[var(--brand-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]">
                          {en ? "Shooter profile" : "Profil strelca"}
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 15L15 5M7 5h8v8" /></svg>
                        </Link>
                      )}
                    </div>
                  </div>
                  {cells.length > 0 && <div className="mt-2"><SheetCells cells={cells} /></div>}
                </div>
              );
            })}
            {stRounds && stRounds.sums.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{en ? "Team total per round" : "Zbir tima po rundi"}</h3>
                <SheetCells cells={stRounds.sums.map((sum, i) => ({ label: `R${i + 1}`, main: sum != null ? fmt(sum) : "—", best: stRounds.won[i] }))} />
              </div>
            )}
          </SheetFrame>
        </BottomSheet>
      );
    })()}
  </div>;
}
