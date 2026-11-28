// Klupske ekipe takmičenja → isti blokovi disciplina i kategorija u kojima su njihovi pojedinačni rezultati.
import type { AgeCategory } from "@shootermarkt/db/schema";
import { categoryLabel, localizeMatchName } from "@/lib/match-name";
import { countryNames, foldSearch } from "@/lib/country-search";
import { displayNoc, NOC_LIST } from "@shootermarkt/db/noc-list";
import type { DisciplineGroup } from "@/app/(site)/[locale]/(public)/[scope]/takmicenja/[id]/CompetitionResultsClient";

/** `firstName`/`lastName` su sa povezanog profila; `name` je zapis iz biltena. */
export type TeamMemberRow = { shooterId: number | null; name: string; firstName?: string | null; lastName?: string | null; nationality?: string | null; series: number[]; total: string; inners: number | null };
export type TeamRow = { id: number; teamName: string; rank: number | null; total: string | null; inners: number | null; remark: string | null; members: TeamMemberRow[] };
export type CompetitionTeam = TeamRow & {
  disciplineCode: string; disciplineName: string; apparatus: string | null; category: AgeCategory;
  competitionEventId: number | null; eventName: string | null; eventDate: string | null;
};

// reverse: prvi upis pobeđuje, jer Intl i za "YU"/"CS" vraća "Serbia"
const NOC_BY_TEAM_NAME = new Map(NOC_LIST.flatMap((n) =>
  [n.noc, n.name, ...countryNames(n.alpha2)].map((name) => [foldSearch(name), n.noc] as const)).reverse());

/** Država ekipe: iz naziva kad je ekipa reprezentacija ("France", "Serbia 2"), inače zajednička država svih strelaca. */
export function teamNoc(team: Pick<TeamRow, "teamName" | "members">): string | null {
  const named = NOC_BY_TEAM_NAME.get(foldSearch(team.teamName.replace(/\s+(\d+|I{1,3})$/, "").trim()));
  if (named) return displayNoc(named);
  const nocs = new Set(team.members.map((m) => displayNoc(m.nationality) || null));
  return nocs.size === 1 ? [...nocs][0] : null;
}

/** Dodaje ekipe u blokove (ključ kao kod pojedinačnih: "APM" ili "APM@4"); blok ili kategoriju koji ne postoje pravi. */
export function attachTeams(groups: DisciplineGroup[], teams: CompetitionTeam[], locale: string): DisciplineGroup[] {
  const out = groups.map((g) => ({ ...g, categories: g.categories.map((c) => ({ ...c })) }));
  for (const { disciplineCode, disciplineName, apparatus, category, competitionEventId, eventName, eventDate, ...team } of teams) {
    const key = competitionEventId ? `${disciplineCode}@${competitionEventId}` : disciplineCode;
    // disciplina sa više mečeva ima blok po meču i kategoriji (id ≠ key)
    let group = out.find((g) => g.key === key && g.categories.some((c) => c.category === category))
      ?? out.find((g) => g.key === key && g.id === key);
    if (!group) {
      const split = competitionEventId != null || out.some((g) => g.code === disciplineCode && g.id !== g.key);
      const name = `${categoryLabel(category, locale)} · ${eventName ?? "1. meč"}`.replace(/ · \d{2}\.\d{2}\.$/, "");
      group = {
        id: split ? `${key}|${category}` : key, key, code: disciplineCode, name: disciplineName, eventName,
        label: split ? localizeMatchName(name, locale) : null, date: eventDate, apparatus, categories: [],
      };
      out.push(group);
    }
    let own = group.categories.find((c) => c.category === category);
    if (!own) {
      own = { category, results: [] };
      group.categories.push(own);
    }
    own.teams = [...(own.teams ?? []), team];
  }
  return out;
}
