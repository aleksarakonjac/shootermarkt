# Handoff: RFPM na standby + čišćenje Dohe

**Grana:** `admin-competition-results-manager` (poslednji commit `e1c06ab`).
**Na `main` su:** panel "Rezultati" u edit takmičenja, uklonjen RFPM iz ISSF mapiranja rasporeda.
**Samo na grani (nisu na `main`):**
- `d1f75cb` — ISSF uvoz rasporeda preskače postojeće termine (ranije je ponovni import duplirao raspored).
- `e1c06ab` — RFPM uklonjen iz seed-a, imena, redosleda i distance tagova; live-fetch cron preskače RFPM.

Pre rada: `git fetch origin && git checkout admin-competition-results-manager`, pa po želji prebaci na `main`.

## Zadatak za lokalnu sesiju

Pošto cloud sesija nema pristup bazi, ovo se radi lokalno sa tvojim `.env` (`DATABASE_URL`).

Napiši skriptu `packages/db/src/scripts/remove-rfpm.ts` (pogledaj kako se ostale skripte u `packages/db` povezuju na bazu) koja:

1. **Dry-run (podrazumevano):** ispiše po takmičenju koliko bi se obrisalo:
   - `results` sa disciplinom `RFPM`,
   - `competition_schedule` termine sa disciplinom `RFPM`,
   - `competition_events` koji ostaju bez rezultata.
2. **`--apply`:** u jednoj transakciji obriše to, pa preračuna forma keš (`recomputeFormaCache` iz `apps/web/src/lib/forma-cache.ts`) za pogođene strelce i `refreshDisciplineGroups` (`apps/web/src/lib/discipline-groups.ts`) za pogođena takmičenja.
3. Ne briše red `RFPM` iz tabele `disciplines` i ne dira enum. RFPM ostaje na standby do implementacije pravila.

Prvo pokreni dry-run i proveri izlaz (posebno raspored Dohe), pa tek onda `--apply`. Preporuka: Supabase backup pre brisanja.

Posle brisanja pokreni sync rasporeda za Dohu iz admina (`/admin/issf/schedule/changes`), da se potvrdi da RFPM termini ne ulaze nazad.

## Duplikati rasporeda za Dohu

Ako je raspored i dalje dupliran od ponovnog uvoza (popravka `d1f75cb` sprečava nove duplikate, ne briše stare):

```sql
delete from competition_schedule
where id in (
  select id from (
    select id, row_number() over (
      partition by competition_id, discipline_id, stage, category, start_time
      order by id) as rn
    from competition_schedule where competition_id = <ID_DOHE>
  ) t where rn > 1
);
```

Prvo zameni u `select` da vidiš koliko redova ide.

## Nije verifikovano

Cloud sesija nije imala instalirane zavisnosti. Ništa nije pokretano: ni `tsc`, ni testovi, ni aplikacija. Prvo:

```
pnpm install
pnpm --filter @shootermarkt/web exec tsc --noEmit
pnpm --filter @shootermarkt/web test
```

Posebno proveri panel "Rezultati" na edit stranici takmičenja (`apps/web/src/app/(site)/(admin)/admin/takmicenja/[id]/edit/results-manager.tsx` i API `apps/web/src/app/api/admin/competitions/[id]/results/route.ts`).

## Za kasnije (RFPM implementacija)

Kad pravila budu poznata, vrati RFPM u: seed, `REVIEW_DISCIPLINE_CODES` (`packages/db/src/discipline.ts`), `SUPPORTED_CODES` (`apps/web/src/lib/sius-import.ts`), `DisciplineCode` tip i `DISCIPLINE_META` (`packages/db/src/pdf-import-types.ts`), `ISSF_EVENT_MAP` i `EVENT_DISCIPLINE_MAP` (`packages/adapters/src/issf/adapter.ts`), `DISCIPLINE_RULES` (`apps/web/src/lib/forma.ts`), kvalifikacioni prikaz (`CompetitionQualTable.tsx`), imena i redosled prikaza, i ukloni cron filter u `apps/web/src/app/api/cron/live-fetch/route.ts`. RFPM format: 60 hitaca (2×30), finale drugačiji.

## Otvoreno

- FPM (50m slobodni pištolj) je mapiran u rasporedu a ne uvozi se, isti problem kao RFPM.
- `POST /api/admin/issf/schedule` uvek upisuje `category: "senior"`; `schedule-sync` ispravno razlikuje junior termine.
