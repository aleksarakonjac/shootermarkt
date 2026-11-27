# Mešoviti timovi: zaseban meč, datum i veza sa profilima — plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mik tim pripada meču takmičenja (naziv + datum), dva meča iste discipline mogu da postoje, a članovi iz baze se povezuju sa profilom.

**Architecture:** `mixed_team_results.competition_event_id` (isti `competition_events` kao pojedinačni). Upis ide kroz `commitMixedTeamEntries`, koji dobija event i povezivanje članova. PDF parser i SIUS uvoz timu daju datum/naziv meča; PDF pregled ima zasebnu kvačicu za timove.

**Tech Stack:** Next.js 16, Drizzle ORM 0.45 / drizzle-kit 0.31, Postgres (Supabase), vitest, unpdf.

**Spec:** `docs/superpowers/specs/2026-11-27-mixed-team-matches-design.md`

## Global Constraints

- Postojeći timovi ostaju: `competition_event_id = null` = glavni meč. Ništa se ne briše ni premešta.
- Unique: `(competition_id, competition_event_id, discipline_id, category, noc_code, team_number) NULLS NOT DISTINCT`.
- Povezivanje: samo `matchShooter(...).kind === "exact"`; postojeća veza se ne gazi (`coalesce`); novi strelci se ne prave.
- Migracija se samo generiše i commituje; `db:migrate` na bazu tek uz izričito odobrenje korisnika, **pre** deploya koda.
- Testovi ne pišu u bazu (`.env.local` je deljena baza). DB putanje se proveravaju typecheck-om i skriptom samo za čitanje.
- Pnpm skripte iz `package.json`, ne sirovi `npx` (memorija korisnika), osim `vitest`/`tsc` za pojedinačne fajlove.

## Review Focus

1. Ponovni uvoz istog biltena bez kvačice: timovi se ažuriraju u glavnom meču, ne dupliraju (test u Task 2: grupni ključ `null` event).
2. Brisanje svih pojedinačnih rezultata meča dok timovi istog eventa ostaju: event se ne sme obrisati (Task 3).
3. Član tima sa nesigurnim pogotkom (suggestion) ili istim imenom u drugoj državi: ne povezuje se (Task 2).
4. Isti tim u kvalifikacijama i finalu drugog dana (SIUS, live): finale mora na isti red kao kvalifikacije, ne u novi event (Task 4: event po datumu kvalifikacija).
5. Kvačica za timove uključena, pa naziv obrisan: unos blokiran porukom „Svaki dodatni meč mora imati naziv“ (Task 6).

---

### Task 1: Šema i migracija

**Files:**
- Modify: `packages/db/src/schema.ts` (`mixedTeamResults`, ~665–708)
- Create: `packages/db/drizzle/0054_*.sql` + `meta` (generiše drizzle-kit)

**Interfaces:**
- Produces: `mixedTeamResults.competitionEventId: integer | null` (FK `competition_events.id`), unique `mixed_team_results_comp_event_disc_cat_noc_unique`.

- [ ] **Step 1:** dodaj `competitionEventId: integer("competition_event_id").references(() => competitionEvents.id)`; zameni `uniqueIndex(...comp_disc_cat_noc_unique)` sa `unique("mixed_team_results_comp_event_disc_cat_noc_unique").on(competitionId, competitionEventId, disciplineId, category, nocCode, teamNumber).nullsNotDistinct()` (obrazac `results_shooter_comp_event_disc_cat_unique`).
- [ ] **Step 2:** `pnpm --filter @shootermarkt/db db:generate`. Očekivano: nov SQL sa `ADD COLUMN`, `ADD CONSTRAINT ... FOREIGN KEY`, `DROP INDEX "mixed_team_results_comp_disc_cat_noc_unique"`, `ADD CONSTRAINT ... UNIQUE NULLS NOT DISTINCT`. Ništa drugo; ako generator doda tuđe razlike, stani i javi.
- [ ] **Step 3:** `npx tsc --noEmit -p packages/db` prolazi.
- [ ] **Step 4:** commit `Mixed teams: competition_event_id and per-match unique key`.

### Task 2: Upis timova u meč i povezivanje članova

**Files:**
- Modify: `packages/db/src/pdf-import-types.ts` (`MixedTeamEntry`: `eventName?: string | null; eventDate?: string | null`)
- Modify: `apps/web/src/lib/import-commit-mixed.ts`
- Modify: `apps/web/src/app/(site)/(admin)/admin/rezultati/_shared/commitMixedTeams.ts`
- Create: `apps/web/src/lib/mixed-team-link.ts`
- Test: `apps/web/src/lib/mixed-team-link.test.ts`, `apps/web/src/app/(site)/(admin)/admin/rezultati/_shared/commitMixedTeams.test.ts`

**Interfaces:**
- Consumes: Task 1 kolona; `ensureCompetitionEvent(competitionId, name, date)`; `matchShooter`, `shooterResultCount`.
- Produces:
  - `MixedCommitInput` + `eventName?: string | null; eventDate?: string | null`.
  - `linkTeamMembers(entry: MixedCommitEntry, nocCode: string, shooters: MatchCandidate[]): { shooter1Id: number | null; shooter2Id: number | null }` u `mixed-team-link.ts` (čista funkcija; `MatchCandidate` = tip koji `matchShooter` prima).
  - `commitMixedStages` grupiše po `${disciplineCode}|${category ?? "senior"}|${eventName ?? ""}` i prosleđuje `eventName`/`eventDate` u `StageInput`.

- [ ] **Step 1: testovi koji padaju**
  - `linkTeamMembers`: tačno ime + ista država → oba id-ja; ime koje daje `suggestion` → `null`; isto ime, druga država (`CRO` vs `SRB`) → `null`.
  - `commitMixedStages` (callback hvata pozive): timovi istog `APMT` u dva eventa (`null` i `"Salona Trophy 2026 · mešoviti timovi"`) → 4 poziva (kval + finale po eventu), svaki sa svojim `eventName`/`eventDate`; timovi bez eventa → `eventName` `undefined`/`null` (Review Focus 1).
- [ ] **Step 2:** `npx vitest run src/lib/mixed-team-link src/app/(site)/(admin)/admin/rezultati/_shared/commitMixedTeams` u `apps/web` → FAIL.
- [ ] **Step 3: implementacija**
  - `mixed-team-link.ts`: `matchShooter(first, last, noc, shooters)` za oba člana (`m_firstName/m_lastName`, `f_…`).
  - `commitMixedTeamEntries`: event id iz `ensureCompetitionEvent` kad je `eventName` zadat; `loadTeams` filtrira `competitionEventId` (`isNull` / `eq`); `values` + `target` dobijaju `competitionEventId`; samo pri kvalifikacijama (`!isFinals`) učitaj strelce jednom (kao `commitImportReview`) i upiši `shooter1Id/shooter2Id` u `values`, u `set` kao `coalesce(excluded.shooter1_id, mixed_team_results.shooter1_id)`.
  - `previewMixedTeams`: poredi po eventu (event id iz imena preko `competitionEvents`, nepostojeći event = nov tim).
  - `commitMixedStages`: novi grupni ključ, `eventName`/`eventDate` u oba poziva; `toQualCommit`/`toFinalCommit` bez promene.
- [ ] **Step 4:** isti testovi PASS; `pnpm --filter @shootermarkt/web test` i `npx tsc --noEmit -p apps/web` prolaze.
- [ ] **Step 5:** commit `Mixed teams: commit into a match and link members to profiles`.

### Task 3: Admin rezultati, brisanje i live cron

**Files:**
- Modify: `apps/web/src/app/api/admin/competitions/[id]/results/route.ts`
- Modify: `apps/web/src/app/(site)/(admin)/admin/takmicenja/[id]/edit/results-manager.tsx` (ako tip grupe to traži)
- Modify: `apps/web/src/app/api/cron/live-fetch/route.ts` (~455–475)

**Interfaces:**
- Consumes: Task 1.
- Produces: mik grupe u GET odgovoru sa `eventId`, `eventName`, `eventDate` (isti oblik kao pojedinačne); DELETE `kind: "mixed"` poštuje `eventId` kao pojedinačni.

- [ ] **Step 1:** GET: mik upit `leftJoin(competitionEvents)` + `groupBy` event, kao pojedinačni; ukloni ručno `eventId: null`.
- [ ] **Step 2:** DELETE mixed: uslov `hasEvent ? (eventId === null ? isNull(...) : eq(...)) : undefined`. Čišćenje praznih eventa (oba puta) mora imati i `notExists(mixed_team_results where competition_event_id = event.id)` (Review Focus 2).
- [ ] **Step 3:** live cron: `target` dobija `mixedTeamResults.competitionEventId`; merge ključ ostaje (redovi su uvek `null` event). Bez promene ponašanja.
- [ ] **Step 4:** `npx tsc --noEmit -p apps/web`, `pnpm --filter @shootermarkt/web test` prolaze.
- [ ] **Step 5:** commit `Mixed teams: per-match admin results and safe event cleanup`.

### Task 4: SIUS uvoz — drugi meč mik tima

**Files:**
- Modify: `apps/web/src/lib/sius-import.ts` (petlja `mixedData`, ~200–215)

**Interfaces:**
- Consumes: Task 2 (`MixedTeamEntry.eventName/eventDate`), `matchEventName(match, date)`, `parseSiusMatchKey`.

- [ ] **Step 1:** ukloni `if (match > 1) { errors.push(...); continue; }` i ponytail komentar.
- [ ] **Step 2:** kao kod pojedinačnih: `eventName = (data.matchCount ?? 1) > 1 && data.date ? matchEventName(match, data.date) : null`, `eventDate` isto; upiši u svaki entry. Ako `fetchLiveSiusMixedTeamResults` ne vraća `matchCount/date`, dodaj ih u adapteru istim putem kao `fetchLiveSiusResults` (`assignSiusMatches`) — event po datumu kvalifikacija, finale bez kvalifikacija nastavlja prethodni meč (Review Focus 4).
- [ ] **Step 3:** adapter test u `packages/adapters/src/sius/public-adapter.test.ts` ako je Step 2 menjao adapter: dva `ARMT` događaja dva dana → ključevi `ARMT`, `ARMT#2` sa `matchCount: 2` i datumima.
- [ ] **Step 4:** testovi i typecheck (adapters + web) prolaze; skripta samo za čitanje: `importSiusCompetition(67, …)` (Šamorin) i dalje `changed 0` za timove.
- [ ] **Step 5:** commit `SIUS import: keep a second mixed team match`.

### Task 5: PDF parser — meč i datum tima

**Files:**
- Modify: `packages/adapters/src/pdf-import/sius-teams.ts`, `sius-pdf.ts`
- Test: `packages/adapters/src/pdf-import/sius-pdf-international.test.ts`

**Interfaces:**
- Produces: `extractSiusPages(pdfBuffer: Buffer): Promise<Item[][]>` (izdvojena petlja iz `parseSiusPdf`); svaki `MixedTeamEntry` ima `eventDate` (datum njegovih strana, `YYYY-MM-DD`) i `eventName: null`; dva datuma iste discipline = dva skupa timova, bez upozorenja.

- [ ] **Step 1: testovi koji padaju**
  - Salona: svaki tim `eventDate === "2026-10-23"`, `eventName === null`.
  - Iz `extractSiusPages(fixture)` kopiraj ARMT strane sa imenom fajla `…2310…` promenjenim u `…2410…`; `parseSiusPages(pages)` → 38 ARMT timova u dva datuma, `warnings` bez „drugi meč“.
- [ ] **Step 2:** `npx vitest run src/pdf-import/sius-pdf-international` u `packages/adapters` → FAIL.
- [ ] **Step 3:** `parseMixedTeams` obrađuje svaki datum (umesto samo `firstDate`); numeracija timova po državi i `byKey` su po datumu. `parseSiusPdf` = `parseSiusPages(await extractSiusPages(buf))`.
- [ ] **Step 4:** svi adapter testovi PASS; postojeći bilteni (kup, memorijal) daju iste liste.
- [ ] **Step 5:** commit `PDF import: mixed teams of every match day, with their date`.

### Task 6: PDF pregled — zaseban meč za timove

**Files:**
- Modify: `apps/web/src/app/(site)/(admin)/admin/rezultati/modes/PdfMode.tsx`
- Test: `apps/web/src/app/(site)/(admin)/admin/rezultati/modes/PdfMode.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`commitMixedTeams` šalje `eventName/eventDate`), Task 5 (`eventDate` iz biltena).

- [ ] **Step 1: test koji pada** („PdfMode: zaseban meč za timove“): rezultat posla sa jednim pojedinačnim redom (`eventName: "Salona Trophy 2026"`, `fromMain`) i jednim timom (`eventDate: "2026-10-23"`). Klik na checkbox „Mešoviti timovi su zaseban meč“ → polja „Naziv meča timova“ = `"Salona Trophy 2026 · mešoviti timovi"`, „Datum meča timova“ = `"2026-10-23"`. Obriši naziv + unos → poruka „Svaki dodatni meč mora imati naziv“ (Review Focus 5). Vrati naziv + unos → oba `commit-mixed` poziva nose `eventName: "Salona Trophy 2026 · mešoviti timovi"`, `eventDate: "2026-10-23"`. Kad su pojedinačni zaseban meč a timovi nisu → vidljiv tekst „Timovi idu u glavni meč“.
- [ ] **Step 2:** `npx vitest run "admin/rezultati/modes/PdfMode.test"` → FAIL.
- [ ] **Step 3:** state `teamMatch: { name: string; date: string } | null`; na uključivanje predpopuni (naziv meča pojedinačnih + `" · mešoviti timovi"` ili prazno; datum = najraniji `eventDate` timova); pri unosu svakom timu postavi `eventName/eventDate` iz `teamMatch` ili `null`; validacija naziv + datum kao za pojedinačne.
- [ ] **Step 4:** test PASS, ceo web test i typecheck prolaze.
- [ ] **Step 5:** commit `PDF import: separate match for mixed teams`.

### Task 7: Prikaz — stranica takmičenja i istorija strelca

**Files:**
- Modify: `apps/web/src/app/(site)/[locale]/(public)/[scope]/takmicenja/[id]/page.tsx` (mik upit ~126–156, grupisanje ~254–267)
- Modify: `apps/web/src/lib/shooter-mixed-results.ts`
- Test: `apps/web/src/lib/shooter-mixed-results.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `MixedRowInput` + `eventName: string | null; eventDate: string | null`; `toMixedHistoryRow` → `competitionDate = eventDate ?? competitionDate`, `competitionName` sa ` — ${localizeMatchName(eventName, locale)}` kao pojedinačni (ili samo `eventName` polje ako lokalizacija nije dostupna u lib-u — prati kako `strelci/[id]/page.tsx` radi za pojedinačne).

- [ ] **Step 1: test koji pada:** `toMixedHistoryRow` sa `eventDate: "2026-10-23"`, `eventName: "Salona Trophy 2026 · mešoviti timovi"` → datum `2026-10-23` i naziv meča u redu; bez eventa → kao do sada.
- [ ] **Step 2:** `npx vitest run src/lib/shooter-mixed-results` → FAIL.
- [ ] **Step 3:** upit `leftJoin(competitionEvents)` u `shooter-mixed-results.ts`; stranica takmičenja: mik upit čita event, grupni ključ `${code}|${category}|${eventId ?? ""}`, `date = eventDate ?? scheduledDate ?? null`, naziv grupe sa nazivom meča kad postoji (isti obrazac kao `label` pojedinačnih).
- [ ] **Step 4:** test PASS, web test + typecheck prolaze.
- [ ] **Step 5:** commit `Mixed teams: show match name and date`.

### Task 8: Provera i puštanje

- [ ] **Step 1:** `pnpm --filter @shootermarkt/web test`, adapters/db `vitest run`, `tsc` za web, ingest, adapters, db — sve prolazi.
- [ ] **Step 2:** skripta samo za čitanje: Salona PDF → 36 timova, `eventDate 2026-10-23`; `previewMixedTeams(45, …)` bez grešaka (posle migracije).
- [ ] **Step 3:** **pitaj korisnika** za `pnpm --filter @shootermarkt/db db:migrate` na bazu; posle migracije proveri da postojeći timovi imaju `competition_event_id is null` i da je novi unique na mestu.
- [ ] **Step 4:** tek posle migracije push (uz odobrenje), sačekaj oba Vercel deploya.
