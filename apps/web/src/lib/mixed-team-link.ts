import { sql } from "drizzle-orm";
import { mixedTeamResults } from "@shootermarkt/db/schema";
import { asIssfId, foldName, foldNameSql, matchAthlete, normalizeNoc, type AgeContext, type MatchCandidate } from "@shootermarkt/db/name-match";
import type { MixedCommitEntry } from "@/lib/import-commit-mixed";

export interface TeamRow {
  nocCode: string;
  teamNumber: number;
  shooter1Name?: string | null;
  shooter2Name?: string | null;
  shooter1Id?: number | null;
  shooter2Id?: number | null;
}

/** Članovi nezavisno od redosleda, i reči u imenu ("MIKEC Tea" = "Tea MIKEC"). */
const memberNames = (t: TeamRow) => [t.shooter1Name, t.shooter2Name]
  .map((name) => (name ?? "").split(/\s+/).map(foldName).sort().join(""))
  .filter(Boolean);
const memberIds = (t: TeamRow) => [t.shooter1Id, t.shooter2Id].filter((id): id is number => id != null);

/** Ključ para za spajanje faza istog upisa; tim bez imena ostaje vezan za svoj broj. */
export const pairKey = (t: TeamRow) => `${t.nocCode}|${memberNames(t).sort().join("|") || t.teamNumber}`;

/**
 * Broj tima je deo ključa reda, a izvori ga dodeljuju po redosledu na listi (menja se sa plasmanom i fazom).
 * Zato tim zadržava broj postojećeg reda sa istim članovima (po imenu, pa po profilu; dovoljan je jedan),
 * a nepoznat par dobija svoj broj ako je slobodan, inače prvi slobodan — tuđ red se ne prepisuje.
 * `stored` su redovi istog takmičenja, meča, discipline i kategorije; vraća `incoming` istim redom.
 * ponytail: par kome se promene oba imena i oba profila dobija nov red, a stari ostaje za ručno brisanje.
 */
export function alignTeamNumbers<T extends TeamRow>(incoming: T[], stored: TeamRow[]): T[] {
  const shared = <V>(a: V[], b: V[]) => a.filter((x) => b.includes(x)).length;
  const matches = incoming.flatMap((team, i) => stored
    .filter((row) => row.nocCode === team.nocCode)
    .map((row) => ({
      i,
      row,
      score: 3 * shared(memberNames(team), memberNames(row)) + shared(memberIds(team), memberIds(row)),
    })))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.row.teamNumber === incoming[b.i].teamNumber) - Number(a.row.teamNumber === incoming[a.i].teamNumber));

  const numbers = new Map<number, number>();
  const taken = new Set<string>();
  const slot = (nocCode: string, teamNumber: number) => `${nocCode}#${teamNumber}`;
  const assign = (i: number, teamNumber: number) => {
    numbers.set(i, teamNumber);
    taken.add(slot(incoming[i].nocCode, teamNumber));
  };
  for (const { i, row } of matches) {
    if (!numbers.has(i) && !taken.has(slot(row.nocCode, row.teamNumber))) assign(i, row.teamNumber);
  }
  // bez imena i profila nema po čemu da se prepozna: broj iz izvora
  incoming.forEach((team, i) => {
    if (!numbers.has(i) && !memberNames(team).length && !memberIds(team).length && !taken.has(slot(team.nocCode, team.teamNumber))) assign(i, team.teamNumber);
  });
  for (const row of stored) {
    if (memberNames(row).length || memberIds(row).length) taken.add(slot(row.nocCode, row.teamNumber));
  }
  incoming.forEach((team, i) => {
    if (numbers.has(i)) return;
    let teamNumber = team.teamNumber;
    if (taken.has(slot(team.nocCode, teamNumber))) for (teamNumber = 1; taken.has(slot(team.nocCode, teamNumber)); teamNumber++);
    assign(i, teamNumber);
  });
  return incoming.map((team, i) => ({ ...team, teamNumber: numbers.get(i)! }));
}

/**
 * shooterN_id pri ponovnom upisu reda tima. Na mestu u timu može da se pojavi drugi strelac (zamena člana,
 * ispravka imena): stara veza važi samo dok je ime na tom mestu isto, inače se uzima nova (i kad je prazna).
 * `prefer` bira pobednika za isto ime: uvoz čuva postojeću (ručno povezivanje, cron) osim kad je nova nađena po
 * ISSF ID-u; cron uzima novu ako je ima.
 */
export function teamLinkOnConflict(slot: 1 | 2, prefer: "stored" | "incoming") {
  const id = slot === 1 ? mixedTeamResults.shooter1Id : mixedTeamResults.shooter2Id;
  const name = slot === 1 ? mixedTeamResults.shooter1Name : mixedTeamResults.shooter2Name;
  const newId = sql.raw(`excluded.shooter${slot}_id`);
  const newName = sql.raw(`excluded.shooter${slot}_name`);
  const same = prefer === "stored" ? sql`coalesce(${id}, ${newId})` : sql`coalesce(${newId}, ${id})`;
  // bez imena na jednoj strani poređenje je null → važi kao isto ime
  return sql`case when ${foldNameSql(name)} <> ${foldNameSql(newName)} then ${newId} else ${same} end`;
}

/** Veza je nađena po ISSF ID-u: sigurna je, pa pri ponovnom uvozu zamenjuje i vezu na imenjaka sa istim imenom. */
export const isIssfLink = (issfId: string | null | undefined, shooterId: number | null | undefined, shooters: MatchCandidate[]) =>
  !!asIssfId(issfId) && shooters.some((s) => s.id === shooterId && s.issfId === issfId);

/**
 * Članovi tima → strelci iz baze, samo za siguran pogodak: isti ISSF ID, inače tačno ime (bez varijanti) i ista država.
 * Strožije od pojedinačnih (matchShooter pušta SRB/AIN i strelce bez države): veza koju upis napravi
 * ostaje dok se ime ne promeni, pa pogrešna preživljava ponovni uvoz.
 */
export function linkTeamMembers(entry: Pick<MixedCommitEntry, "m_firstName" | "m_lastName" | "mIssfId" | "f_firstName" | "f_lastName" | "fIssfId">, nocCode: string, shooters: MatchCandidate[], age?: AgeContext) {
  const link = (id?: string | null, first?: string, last?: string) => {
    const issfId = asIssfId(id);
    const linked = issfId && shooters.find((s) => s.issfId === issfId);
    if (linked) return linked.id;
    if (!first?.trim() || !last?.trim()) return null;
    const nation = normalizeNoc(nocCode);
    const sameNation = shooters.filter((s) => s.nationality && normalizeNoc(s.nationality) === nation);
    const match = matchAthlete(issfId, first, last, nocCode, sameNation, { exactOnly: true, age });
    return match.kind === "exact" ? match.id : null;
  };
  return {
    shooter1Id: link(entry.mIssfId, entry.m_firstName, entry.m_lastName),
    shooter2Id: link(entry.fIssfId, entry.f_firstName, entry.f_lastName),
  };
}
