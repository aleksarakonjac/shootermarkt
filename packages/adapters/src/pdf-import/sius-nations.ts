import { nameKey, normalizeNoc, type MatchCandidate } from "@shootermarkt/db/name-match";
import { NOC_LIST } from "@shootermarkt/db/noc-list";
import { numberTeams, type MixedTeamEntry, type ParsedBilten, type ParsedFinalResult, type ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";

const NOCS = new Set<string>(NOC_LIST.map((c) => c.noc));

/**
 * Strani SIUS bilten: uz domaće strelce stoji samo klub ("UTE"), bez države. Redosled za takve redove:
 * država strelca iz baze → goli kod države ("FIN") → domaćin, uz `nationAssumed` da admin proveri.
 * Domaćin se čita iz baze (najčešća država poznatih strelaca iz klubova bez koda); bez toga ostaje prazan.
 * Domaći bilten ostaje kakav jeste.
 * Mešoviti timovi istim redom; strelac tima nasleđuje i državu sa svog pojedinačnog reda.
 * Par iz dve države dobija obe ("FIN/SLO"); kad se države strelaca ne znaju, dvojna oznaka se proverava.
 */
export function resolveNations(bilten: ParsedBilten, known: Omit<MatchCandidate, "id">[]) {
  const fromDb = dbNations(known);
  resolveUnstated(bilten, fromDb);

  const individual = nationsByName(bilten);
  for (const t of bilten.mixedTeams ?? []) {
    const [m, f] = athletes(t).map((a) => individual.get(nameKey(a.firstName, a.lastName)) ?? fromDb(a));
    if (!m || !f) continue;
    if (m !== f) t.nocCode = `${m}/${f}`;
    else if (t.nocCode.includes("/")) t.nocCode = m; // "SLO-RUS" je klub, ne druga država
    t.nationAssumed = false;
  }
  numberTeams(bilten.mixedTeams ?? []);
}

/** Država sa pojedinačnih redova, samo gde nije pretpostavljena. */
function nationsByName(bilten: ParsedBilten) {
  const rows = bilten.events.flatMap((e) => e.results as (ParsedShooterResult | ParsedFinalResult)[]);
  return new Map(rows.filter((r) => !r.nationAssumed).map((r) => [nameKey(r.firstName, r.lastName), r.teamNoc]));
}

const athletes = (t: MixedTeamEntry) => [
  { firstName: t.mFirstName, lastName: t.mLastName }, { firstName: t.fFirstName, lastName: t.fLastName },
];

/** Država strelca iz baze, po imenu. */
function dbNations(known: Omit<MatchCandidate, "id">[]) {
  // imenjaci iz različitih država → ne pogađa se
  const nations = new Map<string, Set<string>>();
  for (const s of known) {
    const noc = normalizeNoc(s.nationality);
    if (!noc) continue;
    for (const first of [s.firstName, ...(s.previousFirstNames ?? [])]) {
      for (const last of [s.lastName, ...(s.previousLastNames ?? [])]) {
        const key = nameKey(first, last);
        nations.set(key, (nations.get(key) ?? new Set()).add(noc));
      }
    }
  }
  return (r: { firstName: string; lastName: string }) => {
    const found = nations.get(nameKey(r.firstName, r.lastName));
    return found?.size === 1 ? [...found][0] : undefined;
  };
}

function resolveUnstated(bilten: ParsedBilten, fromDb: ReturnType<typeof dbNations>) {
  const rows = bilten.events.flatMap((e) => e.results as (ParsedShooterResult | ParsedFinalResult)[]);
  const open = rows.filter((r) => r.nationUnstated);
  const openTeams = (bilten.mixedTeams ?? []).filter((t) => t.nationUnstated);
  if (!open.length && !openTeams.length) return;
  const plainNoc = (club?: string) => (club && NOCS.has(club.toUpperCase()) ? club.toUpperCase() : undefined);

  const votes = new Map<string, number>();
  const voters = [...open.filter((r) => !plainNoc(r.clubName)), ...openTeams.filter((t) => !plainNoc(t.teamLabel)).flatMap(athletes)];
  for (const [, r] of new Map(voters.map((r) => [nameKey(r.firstName, r.lastName), r]))) {
    const noc = fromDb(r);
    if (noc) votes.set(noc, (votes.get(noc) ?? 0) + 1);
  }
  const host = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];

  // strani: države uz klub ("CZE-DUK"), više golih stranih kodova, ili klubovi bez koda drže stranci
  const prefixed = rows.some((r) => !r.nationUnstated && !r.clubName) || openTeams.some((t) => !t.nocCode);
  const plainForeign = new Set([...open.map((r) => plainNoc(r.clubName)), ...openTeams.map((t) => plainNoc(t.teamLabel))]
    .filter((c) => c && c !== "SRB"));
  if (!prefixed && plainForeign.size < 3 && (!host || host === "SRB")) return;

  for (const r of open) {
    const code = plainNoc(r.clubName);
    const noc = fromDb(r) ?? code;
    r.teamNoc = noc ?? host ?? "";
    r.nationAssumed = !noc;
    if (code) r.clubName = undefined; // kod je bio država, ne klub
  }

  const individual = nationsByName(bilten);
  const agreed = (found: (string | undefined)[]) => {
    const unique = new Set(found.filter(Boolean));
    return unique.size === 1 ? [...unique][0] : undefined;
  };
  for (const t of openTeams) {
    const noc = agreed(athletes(t).map(fromDb)) ?? plainNoc(t.teamLabel)
      ?? agreed(athletes(t).map((a) => individual.get(nameKey(a.firstName, a.lastName))));
    t.nocCode = noc ?? host ?? "";
    t.nationAssumed = !noc;
  }
}
