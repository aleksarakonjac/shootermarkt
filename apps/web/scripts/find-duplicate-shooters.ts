// Read-only: traži duplikate strelaca. Ništa ne upisuje.
//   pnpm --filter @shootermarkt/web db:find-duplicates
// Tri provere:
//   1. isto ime (bez dijakritika, nezavisno od redosleda ime/prezime, uključuje stara prezimena)
//   2. dva strelca sa istim rezultatom (isti meč, disciplina, kategorija, skor) i sličnim imenom
//   3. isti rođendan + slično ime
// Parovi 1 i 3 se filtriraju: oba rođendana poznata a različita = različiti ljudi; bar jedan mora imati
// rezultate ili biti SRB (inače je to samo isto ime u ISSF bazi sveta). --all isključuje taj filter.
// Spajanje: db:merge-shooters -- --keep <id> --drop <id>
import { sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";

type S = { id: number; first_name: string; last_name: string; previous_last_names: string[] | null; birth_date: string | null; birth_year: number | null; issf_id: string | null; sius_athlete_id: string | null; nationality: string | null; results: number };

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "dj").toLowerCase().replace(/[^a-z]+/g, " ").trim();
const tokenKey = (first: string, last: string) => [...fold(`${first} ${last}`).split(" ")].sort().join(" ");

function lev(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

const ALL = process.argv.includes("--all");
const knownBirth = (s: S) => (s.birth_date && !s.birth_date.startsWith("0001") ? s.birth_date : null);
const plausible = (a: S, b: S) => {
  if (ALL) return true;
  const ba = knownBirth(a), bb = knownBirth(b);
  if (ba && bb && ba !== bb) return false;
  return a.results > 0 || b.results > 0 || a.nationality === "SRB" || b.nationality === "SRB";
};

const label = (s: S) => `#${s.id} ${s.last_name} ${s.first_name} (${s.birth_date ?? s.birth_year ?? "?"}, ${s.nationality ?? "?"}, issf=${s.issf_id ?? "-"}, sius=${s.sius_athlete_id ?? "-"}, rez=${s.results})`;
const pair = (a: S, b: S) => console.log(`  ${label(a)}\n  ${label(b)}\n  -> db:merge-shooters -- --keep ${a.id} --drop ${b.id}\n`);

async function main() {
  const rows = (await db.execute(sql`
    select s.id, s.first_name, s.last_name, s.previous_last_names, s.birth_date::text as birth_date, s.birth_year, s.issf_id, s.sius_athlete_id, s.nationality,
           (select count(*)::int from results r where r.shooter_id = s.id) as results
    from shooters s order by s.id`)) as unknown as S[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  console.log(`Strelaca: ${rows.length}\n`);

  // 1. isti ključ imena (i za svako staro prezime)
  const groups = new Map<string, Set<number>>();
  for (const s of rows) {
    for (const last of [s.last_name, ...(s.previous_last_names ?? [])]) {
      const k = tokenKey(s.first_name, last);
      (groups.get(k) ?? groups.set(k, new Set()).get(k)!).add(s.id);
    }
  }
  const nameDupes = [...groups.values()].filter((g) => g.size > 1);
  const pairs1: [S, S][] = [];
  const seen1 = new Set<string>();
  for (const g of nameDupes) {
    const ids = [...g];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = byId.get(ids[i])!, b = byId.get(ids[j])!;
      const k = `${a.id}-${b.id}`;
      if (!seen1.has(k) && plausible(a, b)) { seen1.add(k); pairs1.push([a, b]); }
    }
  }
  console.log(`== 1. Isto ime: ${pairs1.length} parova (od ${nameDupes.length} grupa) ==`);
  for (const [a, b] of pairs1) pair(a, b);

  // 2. isti rezultat kod dva različita strelca u istom meču, slično ime (lev <= 2 nad spojenim imenom)
  const same = (await db.execute(sql`
    select a.shooter_id as a_id, b.shooter_id as b_id, c.name as comp, c.date::text as date, a.qual_total::text as total
    from results a join results b
      on a.competition_id = b.competition_id and a.discipline_id = b.discipline_id
     and a.category is not distinct from b.category and a.shooter_id < b.shooter_id
     and a.qual_total is not null and a.qual_total = b.qual_total
    join competitions c on c.id = a.competition_id`)) as unknown as { a_id: number; b_id: number; comp: string; date: string; total: string }[];
  const seen = new Set<string>();
  const resultDupes = same.filter((p) => {
    const a = byId.get(p.a_id)!, b = byId.get(p.b_id)!;
    const d = lev(tokenKey(a.first_name, a.last_name), tokenKey(b.first_name, b.last_name));
    return d <= 2;
  });
  console.log(`== 2. Isti skor u istom meču + slično ime: ${resultDupes.length} ==`);
  for (const p of resultDupes) {
    const key = `${p.a_id}-${p.b_id}`;
    console.log(`  [${p.date}] ${p.comp} — skor ${p.total}`);
    if (!seen.has(key)) { seen.add(key); pair(byId.get(p.a_id)!, byId.get(p.b_id)!); }
  }

  // 3. isti rođendan, isto prezime-početak ili ime-početak
  const byBirth = new Map<string, S[]>();
  for (const s of rows) if (s.birth_date) (byBirth.get(s.birth_date) ?? byBirth.set(s.birth_date, []).get(s.birth_date)!).push(s);
  let n3 = 0;
  const out3: [S, S][] = [];
  for (const g of byBirth.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = g[i], b = g[j];
    if (lev(tokenKey(a.first_name, a.last_name), tokenKey(b.first_name, b.last_name)) <= 4 && !seen1.has(`${a.id}-${b.id}`) && plausible(a, b)) { out3.push([a, b]); n3++; }
  }
  console.log(`== 3. Isti rođendan + slično ime: ${n3} ==`);
  for (const [a, b] of out3) pair(a, b);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
