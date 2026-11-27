/** Klupske ekipe iz SIUS ekipnih lista pojedinačnih disciplina: red ekipe, ispod njega strelci. */
import type { AgeCategory, DisciplineCode, TeamMemberEntry, TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import { splitName } from "./sius-names";
import { clubNation, SCORE, topmost, type Item } from "./sius-layout";

export interface ClubTeamPage { discipline: DisciplineCode; category: AgeCategory; eventName: string | null; eventDate: string; items: Item[] }

type Team = Pick<TeamResultEntry, "teamName" | "rank" | "total" | "inners" | "remark" | "members">;

const UNRANKED = /^(DNS|DNF|DSQ)$/;

/** Ekipe jedne strane; null ako neka ne može pouzdano da se pročita (zbir članova ≠ zbir ekipe). */
function parsePage(items: Item[]): Team[] | null {
  const header = topmost(items);
  const rank = header("Rank");
  const bib = header("Bib No");
  const firstSeries = items.find((it) => it.str === "1" && rank && it.y < rank.y && it.y > rank.y - 15);
  if (!rank || !bib || !firstSeries) return null;
  const bibLeft = bib.x - 3;
  const scoresX = firstSeries.x - 20;
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
    const name = (y: number) => line(y).filter((it) => it.x >= bibLeft && it.x < scoresX && !UNRANKED.test(it.str)).map((it) => it.str).join(" ");
    // uz zbir umeju da stoje oznake u istoj stavci: "630.2 J", "553.5 DNF J"
    const scores = (y: number) => line(y).filter((it) => it.x >= scoresX).map((it) => SCORE.exec(it.str.replace(/(\s+[A-Z]+)+$/, ""))).filter((m): m is RegExpExecArray => !!m);
    const isRanked = ranked.includes(anchor);
    const teamName = name(anchor.y);
    const nation = clubNation(teamName);

    const members: TeamMemberEntry[] = block.filter(startsMember).sort((a, b) => b.y - a.y).flatMap((it) => {
      // rezultat u zagradi ne ulazi u zbir; bez rezultata (DNS) nema šta da uđe
      if (line(it.y).some((x) => x.x >= scoresX && x.str.startsWith("("))) return [];
      const found = scores(it.y);
      const total = found.at(-1);
      if (!total) return [];
      return [{
        ...splitName(name(it.y).replace(/^\d+\s*/, "")),
        teamNoc: nation.teamNoc, ...(nation.nationUnstated ? { nationUnstated: true } : {}),
        series: found.slice(0, -1).map((m) => Number(m[1])), total: Number(total[1]), inners: total[2] ? Number(total[2]) : null,
      }];
    });

    const total = isRanked ? scores(anchor.y).at(-1) : undefined;
    if (!teamName || (isRanked && !(total && members.length && Math.abs(members.reduce((sum, m) => sum + m.total, 0) - Number(total[1])) < 0.05))) return null;
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
