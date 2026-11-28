/** Mešoviti timovi (ARMT/APMT) iz SIUS biltena: kvalifikaciona lista i finale, po dva strelca u timu. */
import { matchEventName, numberTeams, type AgeCategory, type MixedTeamCode, type MixedTeamEntry, type ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { splitName } from "./sius-names";
import { clubNation, countryNoc, NOCS, scoreText, SCORE, topmost, type Item } from "./sius-layout";

export interface TeamPage { discipline: MixedTeamCode; isFinal: boolean; category: AgeCategory; date: string; items: Item[] }

type Scores = { series: number[]; total: number; inners: number | null };
type Athlete = Scores & { name: string; bib: string };
type Team = { rank: number | null; label: string; total: number | null; inners: number | null; qualified: boolean; remark?: string; athletes: Athlete[] };

const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const UNRANKED = /^(DNS|DNF|DSQ)$/;
const stripNumber = (label: string) => label.replace(/\s*\d+$/, "");
/** Finala i međunarodne liste ponavljaju naziv ("BHSE 1 - BHSE"); gost "KLUB - BUL" ostaje ceo. */
const teamName = (label: string) => {
  const [, head, again] = /^(.+?) - (.+)$/.exec(label) ?? [];
  return head && stripNumber(head) === stripNumber(again) ? head : label;
};

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
  // tim bez plasmana (DNS) stoji ispod poslednjeg rangiranog: njegov naslov zatvara blok prethodnog
  const startsAthlete = (it: Item) => it.x >= bibLeft && it.x < bibLeft + 25 && /^\d+(\s|$)/.test(it.str);
  const unranked = body.filter((it) => UNRANKED.test(it.str)
    && !body.some((other) => Math.abs(other.y - it.y) <= 3 && startsAthlete(other))
    && !anchors.some((anchor) => Math.abs(anchor.y - it.y) <= 3));

  const teams: Team[] = [];
  const starts = [...anchors, ...unranked].sort((a, b) => b.y - a.y);
  for (const [i, anchor] of starts.entries()) {
    const ranked = anchors.includes(anchor);
    const nextY = starts[i + 1]?.y ?? -Infinity;
    const block = body.filter((it) => it.y <= anchor.y + 3 && it.y > nextY + 3);
    const line = (y: number) => block.filter((it) => Math.abs(it.y - y) <= 3).sort((a, b) => a.x - b.x);
    const name = (y: number) => line(y).filter((it) => it.x >= bibLeft && it.x < scoresX).map((it) => it.str).join(" ");
    const scores = (y: number): Scores | null => {
      const found = line(y).filter((it) => it.x >= scoresX).map((it) => SCORE.exec(scoreText(it.str))).filter((m): m is RegExpExecArray => !!m);
      const total = found.at(-1);
      return total ? { series: found.slice(0, -1).map((m) => Number(m[1])), total: Number(total[1]), inners: total[2] ? Number(total[2]) : null } : null;
    };

    const athletes = block.filter(startsAthlete)
      .sort((a, b) => b.y - a.y)
      .map((it) => {
        // u timu bez plasmana strelac ume da nema nijedan rezultat (DNS)
        const own = scores(it.y) ?? (ranked ? null : { series: [], total: 0, inners: null });
        return own && { ...own, name: name(it.y).replace(/^\d+\s*/, ""), bib: /^\d+/.exec(it.str)![0] };
      });
    const team = ranked ? scores(anchor.y) : null;
    const complete = athletes.length === 2 && athletes.every((a) => a && a.name && (!a.series.length || near(sum(a.series), a.total)));
    if (!complete || (ranked && !(team && near(sum(athletes.map((a) => a!.total)), team.total)))) return null;
    teams.push({
      rank: ranked ? Number(anchor.str) : null,
      label: teamName(name(anchor.y).replace(/\s*-\s*$/, "")),
      total: team?.total ?? null,
      inners: team?.inners ?? null,
      qualified: ranked && block.some((it) => it.str === "Q"),
      ...(ranked ? {} : { remark: line(anchor.y).find((it) => UNRANKED.test(it.str))!.str }),
      athletes: athletes as Athlete[],
    });
  }
  // poslednja strana liste ume da nosi samo zbir i legendu
  return teams.length || !body.some(startsAthlete) ? teams : null;
}

const athleteKey = (name: string) => name.toLowerCase();
// startni brojevi: finale skraćuje imena ("PÉNI I.")
const teamKey = (t: Team) => t.athletes.map((a) => a.bib).sort().join("|");
/** "SLO-ŠKOFJA LOKA 3" i "ŠKOFJA LOKA 3" → "ŠKOFJA LOKA" */
const clubStem = (label: string) => stripNumber(label.replace(/^[A-Za-z]{3}\s*-\s*/, "")).trim();
/** Država ispred crtice: "CZE-DUK 2", "ESP - Spain", "LUX 1 - Luxembourg". Mora biti stvarna oznaka države. */
const prefixNoc = (label: string) => {
  const code = /^([A-Za-z]{3})(?:\s*\d+)?\s*-/.exec(label)?.[1].toUpperCase();
  return code && NOCS.has(code) ? code : undefined;
};

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
  for (const { teams } of parsed) for (const t of teams) {
    const noc = prefixNoc(t.label);
    if (noc) nationByClub.set(clubStem(t.label), noc);
  }
  const nationByAthlete = new Map(individuals.filter((r) => !r.nationUnstated)
    .map((r) => [athleteKey(r.fullName ?? `${r.lastName} ${r.firstName}`), r.teamNoc]));
  const hasCountryTeams = parsed.some((p) => p.teams.some((t) => (countryNoc(t.label) ?? "SRB") !== "SRB"));
  /** Država iz biltena; kad je nema, `nationUnstated` pa je rešava resolveNations. */
  const nationOf = (t: Team): { nocCode: string; nationUnstated?: boolean; nationAssumed?: boolean; teamLabel?: string } => {
    const prefix = prefixNoc(t.label);
    if (prefix) {
      // "FIN-CZE": možda par iz dve države — proverava se, osim ako resolveNations zna države strelaca
      const second = /^[A-Za-z]{3}-([A-Z]{3})\b/.exec(t.label)?.[1];
      return second && NOCS.has(second) && second !== prefix ? { nocCode: `${prefix}/${second}`, nationAssumed: true } : { nocCode: prefix };
    }
    const country = countryNoc(t.label);
    if (country) return { nocCode: country };
    const own = clubNation(t.label);
    const teamLabel = clubStem(t.label);
    // deo timova nosi ime države: za ostale (klub ili par iz dve države) admin potvrđuje naciju
    if (hasCountryTeams) return { nocCode: own.teamNoc, nationUnstated: true, nationAssumed: true, teamLabel };
    // bez ijedne države uz klub: domaći format, "SRB" važi dok resolveNations ne prepozna strani bilten
    if (nationByClub.size === 0) return own.nationUnstated ? { nocCode: own.teamNoc, nationUnstated: true, teamLabel } : { nocCode: own.teamNoc };
    const found = nationByClub.get(teamLabel) ?? t.athletes.map((a) => nationByAthlete.get(athleteKey(a.name))).find(Boolean);
    return found ? { nocCode: found } : { nocCode: "", nationUnstated: true, teamLabel };
  };

  // finale objavljeno kasnije od kvalifikacija pripada poslednjem danu kvalifikacija do svog datuma
  for (const page of parsed.filter((p) => p.isFinal)) {
    const qualDays = parsed.filter((p) => !p.isFinal && p.discipline === page.discipline && p.category === page.category && p.date <= page.date).map((p) => p.date).sort();
    if (qualDays.length) page.date = qualDays.at(-1)!;
  }
  // svaki dan discipline je svoj meč: timovi, numeracija po državi i finale se vezuju samo unutar dana
  // dani se broje po disciplini i uzrastu: juniori pucani drugog dana od seniora su i dalje svoj prvi meč
  const dayKey = (p: TeamPage) => `${p.discipline}|${p.category}|${p.date}`;
  const days = [...new Set(parsed.map(dayKey))].sort((a, b) => a.split("|")[2].localeCompare(b.split("|")[2]));
  for (const day of days) {
    const [discipline, age, date] = day.split("|") as [MixedTeamCode, string, string];
    const match = parsed.filter((p) => dayKey(p) === day);
    // prvi dan discipline ide u glavni meč; svaki sledeći je zaseban meč, inače bi prepisao prvi
    const nth = days.filter((d) => d.startsWith(`${discipline}|${age}|`)).indexOf(day) + 1;
    const eventName = nth > 1 ? matchEventName(nth, date) : null;
    const category = match[0].category;
    const byKey = new Map<string, { entry: MixedTeamEntry; firstBib: string }>();

    const entry = (t: Team): MixedTeamEntry => {
      const [m, f] = t.athletes.map((a) => splitName(a.name));
      return {
        // domaći naziv tima je klub; sa državom uz naziv ("SLO-…") tim predstavlja državu
        skip: false, ...nationOf(t), ...(prefixNoc(t.label) || countryNoc(t.label) ? {} : { clubName: t.label }), teamNumber: 1, disciplineCode: discipline, category,
        eventName, eventDate: date,
        qualRank: null, qualTotal: null, inners: null, qualified: true, finalRank: null, finalTotal: null,
        mIssfId: null, mLastName: m.lastName, mFirstName: m.firstName, mFullName: m.fullName, m_series: [], mInners: null, mTotal: 0,
        fIssfId: null, fLastName: f.lastName, fFirstName: f.firstName, fFullName: f.fullName, f_series: [], fInners: null, fTotal: 0,
      };
    };

    for (const t of match.filter((p) => !p.isFinal).flatMap((p) => p.teams).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))) {
      const e = entry(t);
      const [m, f] = t.athletes;
      Object.assign(e, {
        qualRank: t.rank, qualTotal: t.total, inners: t.inners, qualified: t.qualified, qualRemark: t.remark,
        m_series: m.series, mInners: m.inners, mTotal: m.total, f_series: f.series, fInners: f.inners, fTotal: f.total,
      });
      byKey.set(teamKey(t), { entry: e, firstBib: m.bib });
    }
    for (const t of match.filter((p) => p.isFinal).flatMap((p) => p.teams)) {
      let found = byKey.get(teamKey(t));
      if (!found) {
        found = { entry: entry(t), firstBib: t.athletes[0].bib };
        byKey.set(teamKey(t), found);
      }
      const e = found.entry;
      // finale ume da navede strelce drugim redom nego kvalifikacije
      const swapped = found.firstBib !== t.athletes[0].bib;
      const [first, second] = swapped ? [t.athletes[1], t.athletes[0]] : t.athletes;
      Object.assign(e, { finalRank: t.rank, finalTotal: t.total, finalRemark: t.remark, mFinalSeries: first.series, fFinalSeries: second.series });
    }
    entries.push(...[...byKey.values()].map((v) => v.entry));
  }
  numberTeams(entries);
  return { entries, warnings };
}
