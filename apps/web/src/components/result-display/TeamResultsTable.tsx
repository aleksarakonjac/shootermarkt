"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { splitDisplayName } from "@shootermarkt/adapters/sius/public-adapter";
import { teamNoc, type TeamMemberRow, type TeamRow } from "@/lib/competition-teams";
import { MedalIcon } from "./MedalIcon";
import { NocChip } from "./ResultSheet";

const mono = "font-[family-name:var(--font-jetbrains-mono)] tabular-nums";
/** Pištolj je ceo broj, puška decimalna; zapis iz baze je uvek sa jednom decimalom. */
const score = (v: string | number) => String(v).replace(/\.0$/, "");

/** Kao u pojedinačnim rezultatima: ime sa profila, prezime istaknuto, ime prigušeno. */
function MemberName({ member }: { member: TeamMemberRow }) {
  const { lastName, firstName } = member.lastName ? { lastName: member.lastName, firstName: member.firstName ?? "" } : splitDisplayName(member.name);
  const content = <><span className="max-w-full shrink-0 truncate font-medium text-[var(--ink)] transition-colors group-hover/name:text-[var(--brand-primary)]">{lastName}</span>{" "}<span className="min-w-0 truncate text-[var(--muted)]">{firstName}</span></>;
  const cls = "group/name flex min-w-0 items-baseline gap-1.5";
  return member.shooterId ? <Link href={`/strelci/${member.shooterId}`} className={cls}>{content}</Link> : <span className={cls}>{content}</span>;
}

/** Klupski ekipni plasman iz biltena; klik na ekipu otvara njene strelce, jedan ispod drugog. */
export function TeamResultsTable({ teams }: { teams: TeamRow[] }) {
  const en = useLocale() === "en";
  const [open, setOpen] = useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();
  const toggle = (id: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const sorted = [...teams].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const allOpen = sorted.every((t) => open.has(t.id));
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
      <div className="flex items-center justify-end bg-[var(--surface)] px-3 py-2">
        <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(sorted.map((t) => t.id)))}
          className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)] transition-colors hover:text-[var(--ink)]">
          {allOpen ? (en ? "Hide all results" : "Sakrij sve rezultate") : (en ? "Show all results" : "Prikaži sve rezultate")}
          <ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-150 ${allOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {sorted.map((team) => {
        const expanded = open.has(team.id);
        const noc = teamNoc(team);
        return (
          <div key={team.id}>
            <button type="button" aria-expanded={expanded} onClick={() => toggle(team.id)}
              className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)] sm:px-4">
              <span className={`flex w-7 shrink-0 justify-center text-sm text-[var(--muted)] ${mono}`}>
                {team.rank == null ? "—" : team.rank <= 3 ? <MedalIcon rank={team.rank} /> : team.rank}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="max-w-full truncate text-sm font-semibold text-[var(--ink)]">{team.teamName}</span>
                {noc && <span className="shrink-0 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.65rem]"><NocChip nationality={noc} /></span>}
              </span>
              {team.remark && <span className={`text-xs font-semibold text-[var(--muted)] ${mono}`}>{team.remark}</span>}
              <span className={`text-sm font-semibold text-[var(--ink)] ${mono}`}>{team.total == null ? "—" : score(team.total)}</span>
              {team.inners != null && <span className={`w-9 text-right text-xs text-[var(--muted)] ${mono}`}>{team.inners}×</span>}
              <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-[var(--subtle)] transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={reducedMotion ? false : { height: 0, opacity: 0, y: -4 }}
                  animate={{ height: "auto", opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0, transition: { duration: 0.18 } }}
                  transition={{ duration: reducedMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden">
                  <ul aria-label={`${en ? "Shooters" : "Strelci"}: ${team.teamName}`} className="border-t border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                    {team.members.map((m, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 pl-13 sm:px-4 sm:pl-14">
                        <span className="flex min-w-0 flex-1 text-sm"><MemberName member={m} /></span>
                        <span className={`order-last flex w-full gap-2 text-xs text-[var(--muted)] sm:order-none sm:w-auto ${mono}`}>
                          {m.series.map((s, n) => <span key={n}>{s}</span>)}
                        </span>
                        <span className={`text-sm font-semibold text-[var(--ink)] ${mono}`}>{score(m.total)}</span>
                        {m.inners != null && <span className={`w-9 text-right text-xs text-[var(--muted)] ${mono}`}>{m.inners}×</span>}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
