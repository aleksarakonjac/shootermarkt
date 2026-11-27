"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { TeamRow } from "@/lib/competition-teams";
import { MedalIcon } from "./MedalIcon";

const mono = "font-[family-name:var(--font-jetbrains-mono)] tabular-nums";
/** Pištolj je ceo broj, puška decimalna; zapis iz baze je uvek sa jednom decimalom. */
const score = (v: string | number) => String(v).replace(/\.0$/, "");

/** Klupski ekipni plasman iz biltena; klik na ekipu otvara njene strelce, jedan ispod drugog. */
export function TeamResultsTable({ teams }: { teams: TeamRow[] }) {
  const en = useLocale() === "en";
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const sorted = [...teams].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
      {sorted.map((team) => {
        const expanded = open.has(team.id);
        return (
          <div key={team.id}>
            <button type="button" aria-expanded={expanded} onClick={() => toggle(team.id)}
              className="flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)] sm:px-4">
              <span className={`flex w-7 shrink-0 justify-center text-sm text-[var(--muted)] ${mono}`}>
                {team.rank == null ? "—" : team.rank <= 3 ? <MedalIcon rank={team.rank} /> : team.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">{team.teamName}</span>
              {team.remark && <span className={`text-xs font-semibold text-[var(--muted)] ${mono}`}>{team.remark}</span>}
              <span className={`text-sm font-semibold text-[var(--ink)] ${mono}`}>{team.total == null ? "—" : score(team.total)}</span>
              {team.inners != null && <span className={`w-9 text-right text-xs text-[var(--muted)] ${mono}`}>{team.inners}×</span>}
              <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-[var(--subtle)] transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
              <ul aria-label={`${en ? "Shooters" : "Strelci"}: ${team.teamName}`} className="border-t border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {team.members.map((m, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 pl-13 sm:px-4 sm:pl-14">
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                      {m.shooterId ? <Link href={`/strelci/${m.shooterId}`} className="hover:text-[var(--brand-primary)] hover:underline">{m.name}</Link> : m.name}
                    </span>
                    <span className={`order-last flex w-full gap-2 text-xs text-[var(--muted)] sm:order-none sm:w-auto ${mono}`}>
                      {m.series.map((s, n) => <span key={n}>{s}</span>)}
                    </span>
                    <span className={`text-sm font-semibold text-[var(--ink)] ${mono}`}>{score(m.total)}</span>
                    {m.inners != null && <span className={`w-9 text-right text-xs text-[var(--muted)] ${mono}`}>{m.inners}×</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
