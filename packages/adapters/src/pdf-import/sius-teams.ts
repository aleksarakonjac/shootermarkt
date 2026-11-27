/** Mešoviti timovi (ARMT/APMT) iz SIUS biltena: kvalifikaciona lista i finale, po dva strelca u timu. */
import type { MixedTeamCode, MixedTeamEntry, ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { splitName } from "./sius-names";
import { clubNation, SCORE, topmost, type Item } from "./sius-layout";

export interface TeamPage { discipline: MixedTeamCode; isFinal: boolean; junior: boolean; date: string; items: Item[] }

type Scores = { series: number[]; total: number; inners: number | null };
type Athlete = Scores & { name: string };
type Team = { rank: number; label: string; total: number; inners: number | null; qualified: boolean; athletes: Athlete[] };

const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Timovi jedne strane; null ako se zbirovi ne slažu ili tim nema tačno dva strelca. */
function parseTeamPage(items: Item[], isFinal: boolean): Team[] | null {
  const header = topmost(items);
  const rank = header(isFinal ? "Rk" : "Rank");
  // finale spaja dva zaglavlja u jedno; "Bib No" tada postoji samo u legendi
  const bib = header("Bib No Name") ?? header("Bib No");
  const firstColumn = isFinal ? header("Stage 1") ?? header("1st Comp.")
    : items.find((it) => it.str === "1" && rank && it.y < rank.y && it.y > rank.y - 15);
  if (!rank || !bib || !firstColumn) return null;
  const bibLeft = bib.x - 3;
  const scoresX = firstColumn.x - (isFinal ? 5 : 20);
  const end = header("Summary")?.y ?? header("Legend")?.y ?? items.find((it) => it.str.startsWith("Version of"))?.y ?? 0;
  const body = items.filter((it) => it.y < rank.y - 3 && it.y > end + 3);
  const anchors = body.filter((it) => it.x < bibLeft && /^\d+$/.test(it.str)).sort((a, b) => b.y - a.y);

  const teams: Team[] = [];
  for (const [i, anchor] of anchors.entries()) {
    const nextY = anchors[i + 1]?.y ?? -Infinity;
    const block = body.filter((it) => it.y <= anchor.y + 3 && it.y > nextY + 3);
    const line = (y: number) => block.filter((it) => Math.abs(it.y - y) <= 3).sort((a, b) => a.x - b.x);
    const name = (y: number) => line(y).filter((it) => it.x >= bibLeft && it.x < scoresX).map((it) => it.str).join(" ");
    const scores = (y: number): Scores | null => {
      const found = line(y).filter((it) => it.x >= scoresX).map((it) => SCORE.exec(it.str)).filter((m): m is RegExpExecArray => !!m);
      const total = found.at(-1);
      return total ? { series: found.slice(0, -1).map((m) => Number(m[1])), total: Number(total[1]), inners: total[2] ? Number(total[2]) : null } : null;
    };

    const athletes = block.filter((it) => it.x >= bibLeft && it.x < bibLeft + 25 && /^\d+(\s|$)/.test(it.str))
      .sort((a, b) => b.y - a.y)
      .map((it) => {
        const own = scores(it.y);
        return own && { ...own, name: name(it.y).replace(/^\d+\s*/, "") };
      });
    const team = scores(anchor.y);
    const valid = team && athletes.length === 2 && athletes.every((a) => a && a.name && near(sum(a.series), a.total))
      && near(sum(athletes.map((a) => a!.total)), team.total);
    if (!valid) return null;
    teams.push({
      rank: Number(anchor.str),
      label: name(anchor.y).replace(/\s*-\s*$/, ""),
      total: team.total,
      inners: team.inners,
      qualified: block.some((it) => it.str === "Q"),
      athletes: athletes as Athlete[],
    });
  }
  return teams.length ? teams : null;
}

const athleteKey = (name: string) => name.toLowerCase();
const teamKey = (t: Team) => t.athletes.map((a) => athleteKey(a.name)).sort().join("|");
/** "SLO-ŠKOFJA LOKA 3" i "ŠKOFJA LOKA 3" → "ŠKOFJA LOKA" */
const clubStem = (label: string) => label.replace(/^[A-Za-z]{3}\s*-\s*/, "").replace(/\s*\d+$/, "").trim();

export function parseMixedTeams(pages: TeamPage[], individuals: ParsedShooterResult[]) {
  const warnings: string[] = [];
  const entries: MixedTeamEntry[] = [];
  const parsed = pages.flatMap((page) => {
    const teams = parseTeamPage(page.items, page.isFinal);
    if (!teams) warnings.push(`Mešoviti tim ${page.discipline}: strana nije pročitana (${page.isFinal ? "finale" : "kvalifikacije"} ${page.date})`);
    return teams ? [{ ...page, teams }] : [];
  });

  // Međunarodni bilten štampa državu uz klub; kad je izostavi, nalazi se preko istog kluba ili strelca.
  const nationByClub = new Map<string, string>();
  for (const { teams } of parsed) for (const t of teams) if (/^[A-Za-z]{3}\s*-/.test(t.label)) nationByClub.set(clubStem(t.label), clubNation(t.label).teamNoc);
  const nationByAthlete = new Map(individuals.map((r) => [athleteKey(r.fullName ?? `${r.lastName} ${r.firstName}`), r.teamNoc]));
  const nationOf = (t: Team) => /^[A-Za-z]{3}\s*-/.test(t.label) ? clubNation(t.label).teamNoc
    : nationByClub.size === 0 ? clubNation(t.label).teamNoc
    : nationByClub.get(clubStem(t.label)) ?? t.athletes.map((a) => nationByAthlete.get(athleteKey(a.name))).find(Boolean);

  // finale objavljeno kasnije od kvalifikacija pripada poslednjem danu kvalifikacija do svog datuma
  for (const page of parsed.filter((p) => p.isFinal)) {
    const qualDays = parsed.filter((p) => !p.isFinal && p.discipline === page.discipline && p.junior === page.junior && p.date <= page.date).map((p) => p.date).sort();
    if (qualDays.length) page.date = qualDays.at(-1)!;
  }
  // svaki dan discipline je svoj meč: timovi, numeracija po državi i finale se vezuju samo unutar dana
  // dani se broje po disciplini i uzrastu: juniori pucani drugog dana od seniora su i dalje svoj prvi meč
  const dayKey = (p: TeamPage) => `${p.discipline}|${p.junior ? "junior" : "senior"}|${p.date}`;
  const days = [...new Set(parsed.map(dayKey))].sort((a, b) => a.split("|")[2].localeCompare(b.split("|")[2]));
  for (const day of days) {
    const [discipline, age, date] = day.split("|") as [MixedTeamCode, string, string];
    const match = parsed.filter((p) => dayKey(p) === day);
    // prvi dan discipline ide u glavni meč; svaki sledeći je zaseban meč, inače bi prepisao prvi
    // (isti oblik naziva kao matchEventName u apps/web/src/lib/match-name.ts)
    const nth = days.filter((d) => d.startsWith(`${discipline}|${age}|`)).indexOf(day) + 1;
    const eventName = nth > 1 ? `${nth}. meč · ${date.slice(8, 10)}.${date.slice(5, 7)}.` : null;
    const category = match[0].junior ? "junior" : "senior";
    const numbers = new Map<string, number>();
    const byKey = new Map<string, MixedTeamEntry>();

    const entry = (t: Team): MixedTeamEntry | null => {
      const nocCode = nationOf(t);
      if (!nocCode) { warnings.push(`Mešoviti tim ${discipline}: nepoznata država za "${t.label}"`); return null; }
      numbers.set(nocCode, (numbers.get(nocCode) ?? 0) + 1);
      const [m, f] = t.athletes.map((a) => splitName(a.name));
      return {
        skip: false, nocCode, teamNumber: numbers.get(nocCode)!, disciplineCode: discipline, category,
        eventName, eventDate: date,
        qualRank: null, qualTotal: null, inners: null, qualified: true, finalRank: null, finalTotal: null,
        mIssfId: null, mLastName: m.lastName, mFirstName: m.firstName, mFullName: m.fullName, m_series: [], mInners: null, mTotal: 0,
        fIssfId: null, fLastName: f.lastName, fFirstName: f.firstName, fFullName: f.fullName, f_series: [], fInners: null, fTotal: 0,
      };
    };

    for (const t of match.filter((p) => !p.isFinal).flatMap((p) => p.teams).sort((a, b) => a.rank - b.rank)) {
      const e = entry(t);
      if (!e) continue;
      const [m, f] = t.athletes;
      Object.assign(e, {
        qualRank: t.rank, qualTotal: t.total, inners: t.inners, qualified: t.qualified,
        m_series: m.series, mInners: m.inners, mTotal: m.total, f_series: f.series, fInners: f.inners, fTotal: f.total,
      });
      byKey.set(teamKey(t), e);
    }
    for (const t of match.filter((p) => p.isFinal).flatMap((p) => p.teams)) {
      let e = byKey.get(teamKey(t));
      // finale ume da navede strelce drugim redom nego kvalifikacije
      const swapped = e ? athleteKey(t.athletes[0].name) !== athleteKey(`${e.mLastName} ${e.mFirstName}`) : false;
      if (!e) {
        e = entry(t) ?? undefined;
        if (!e) continue;
        byKey.set(teamKey(t), e);
      }
      const [first, second] = swapped ? [t.athletes[1], t.athletes[0]] : t.athletes;
      Object.assign(e, { finalRank: t.rank, finalTotal: t.total, mFinalSeries: first.series, fFinalSeries: second.series });
    }
    entries.push(...byKey.values());
  }
  return { entries, warnings };
}
