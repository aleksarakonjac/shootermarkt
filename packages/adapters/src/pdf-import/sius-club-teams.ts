/** Klupske ekipe iz SIUS ekipnih lista pojedinačnih disciplina: red ekipe, ispod njega strelci. */
import type { AgeCategory, DisciplineCode, TeamMemberEntry, TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import { splitName } from "./sius-names";
import { clubNation, countryNoc, scoreText, SCORE, topmost, type Item } from "./sius-layout";

export interface ClubTeamPage { discipline: DisciplineCode; category: AgeCategory; eventName: string | null; eventDate: string; items: Item[] }

type Team = Pick<TeamResultEntry, "teamName" | "rank" | "total" | "inners" | "remark" | "members">;

const UNRANKED = /^(DNS|DNF|DSQ)$/;

type TeamRow = { series: number[]; total: number; inners: number | null };

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const near = (a: number, b: number) => Math.abs(a - b) < 0.05;

/**
 * Članovi koji čine zbir ekipe: oni bez zagrade kad se slažu sa redom ekipe. Omladinski bilten ekipu sastavlja
 * od najboljih među navedenima (i onih u zagradi) bez oznake — tada se traži jedina grupa iste veličine čiji
 * zbir, serije i X daju red ekipe. Bez takve ili sa više njih: null (strana se prijavljuje).
 */
function lineUp(all: TeamMemberEntry[], unbracketed: TeamMemberEntry[], team: TeamRow): TeamMemberEntry[] | null {
  if (near(sum(unbracketed.map((m) => m.total)), team.total)) return unbracketed;
  const groups = (from: number, size: number): TeamMemberEntry[][] => (size === 0 ? [[]]
    : all.slice(from).flatMap((m, i) => groups(from + i + 1, size - 1).map((rest) => [m, ...rest])));
  const fits = groups(0, unbracketed.length).filter((g) => g.length > 0
    && near(sum(g.map((m) => m.total)), team.total)
    && team.series.every((s, i) => near(sum(g.map((m) => m.series[i] ?? 0)), s))
    && (team.inners == null || sum(g.map((m) => m.inners ?? 0)) === team.inners));
  return fits.length === 1 ? fits[0] : null;
}

/** Ekipe jedne strane; null ako neka ne može pouzdano da se pročita (zbir članova ≠ zbir ekipe). */
function parsePage(items: Item[]): Team[] | null {
  const header = topmost(items);
  const rank = header("Rank");
  const bib = header("Bib No");
  const firstSeries = items.find((it) => it.str === "1" && rank && it.y < rank.y && it.y > rank.y - 15);
  if (!rank || !bib || !firstSeries) return null;
  const bibLeft = bib.x - 3;
  const scoresX = firstSeries.x - 20;
  // omladinske ekipe uz strelca štampaju uzrasnu grupu ("Shooter / Group") — nije deo imena
  const group = header("Group") && header("Shooter");
  const nameTo = group ? group.x - 5 : scoresX;
  const end = header("Summary")?.y ?? header("Legend")?.y ?? items.find((it) => it.str.startsWith("Version of"))?.y ?? 0;
  // red ispod zaglavlja su brojevi serija
  const body = items.filter((it) => it.y < firstSeries.y - 3 && it.y > end + 3);
  const startsMember = (it: Item) => it.x >= bibLeft && it.x < bibLeft + 25 && /^\d+(\s|$)/.test(it.str);
  const ranked = body.filter((it) => it.x < bibLeft && /^\d+$/.test(it.str));
  // ekipa bez plasmana: umesto mesta nosi DNS/DNF/DSQ u redu koji nije red strelca
  const unranked = body.filter((it) => UNRANKED.test(it.str)
    && !body.some((other) => Math.abs(other.y - it.y) <= 3 && (startsMember(other) || ranked.includes(other))));
  const anchors = [...ranked, ...unranked].sort((a, b) => b.y - a.y);

  const teams: Team[] = [];
  for (const [i, anchor] of anchors.entries()) {
    const nextY = anchors[i + 1]?.y ?? -Infinity;
    const block = body.filter((it) => it.y <= anchor.y + 3 && it.y > nextY + 3);
    const line = (y: number) => block.filter((it) => Math.abs(it.y - y) <= 3).sort((a, b) => a.x - b.x);
    const name = (y: number) => line(y).filter((it) => it.x >= bibLeft && it.x < nameTo && !UNRANKED.test(it.str)).map((it) => it.str).join(" ");
    // rezultat u zagradi se čita isto; da li ulazi u ekipu odlučuje red ekipe
    const scores = (y: number) => line(y).filter((it) => it.x >= scoresX).map((it) => SCORE.exec(scoreText(it.str).replace(/^\((.*)\)$/, "$1"))).filter((m): m is RegExpExecArray => !!m);
    const isRanked = ranked.includes(anchor);
    const teamName = name(anchor.y);
    const country = countryNoc(teamName);
    const nation = country ? { teamNoc: country, nationUnstated: false } : clubNation(teamName);

    const listed = block.filter(startsMember).sort((a, b) => b.y - a.y).flatMap((it) => {
      const found = scores(it.y);
      const total = found.at(-1);
      // bez rezultata (DNS) nema šta da uđe
      if (!total) return [];
      const member: TeamMemberEntry = {
        ...splitName(name(it.y).replace(/^\d+\s*/, "")),
        teamNoc: nation.teamNoc, ...(nation.nationUnstated ? { nationUnstated: true } : {}),
        series: found.slice(0, -1).map((m) => Number(m[1])), total: Number(total[1]), inners: total[2] ? Number(total[2]) : null,
      };
      return [{ member, bracketed: line(it.y).some((x) => x.x >= scoresX && x.str.startsWith("(")) }];
    });

    const row = scores(anchor.y);
    const total = isRanked ? row.at(-1) : undefined;
    const unbracketed = listed.filter((m) => !m.bracketed).map((m) => m.member);
    const members = !isRanked ? unbracketed
      : total ? lineUp(listed.map((m) => m.member), unbracketed, { series: row.slice(0, -1).map((m) => Number(m[1])), total: Number(total[1]), inners: total[2] ? Number(total[2]) : null }) : null;
    if (!teamName || !members || (isRanked && !members.length)) return null;
    teams.push({
      teamName,
      rank: isRanked ? Number(anchor.str) : null,
      total: total ? Number(total[1]) : null,
      inners: total?.[2] ? Number(total[2]) : null,
      // bilten ume da rangira i ekipu sa DNF — plasman i oznaka ostaju kako pišu
      remark: line(anchor.y).find((it) => UNRANKED.test(it.str))?.str ?? null,
      members,
    });
  }
  return teams.length ? teams : null;
}

export function parseClubTeams(pages: ClubTeamPage[]) {
  const warnings: string[] = [];
  const entries: TeamResultEntry[] = [];
  const names = new Map<string, number>();
  for (const { items, discipline, category, eventName, eventDate } of pages) {
    const teams = parsePage(items);
    if (!teams) {
      warnings.push(`Ekipe ${discipline}: strana nije pročitana (${eventDate})`);
      continue;
    }
    for (const team of teams) {
      // dve ekipe istog naziva u listi: naziv je deo ključa u bazi, pa druga dobija redni broj
      const key = `${discipline}|${category}|${eventName}|${team.teamName}`;
      const n = (names.get(key) ?? 0) + 1;
      names.set(key, n);
      entries.push({ ...team, teamName: n > 1 ? `${team.teamName} (${n})` : team.teamName, skip: false, disciplineCode: discipline, category, eventName, eventDate });
    }
  }
  return { entries, warnings };
}
