# ESC Solo i nova istorija nastupa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uvesti 10m AR/AP ESC Solo sa SIUS-a i prikazati ga na stranici takmičenja i profilu; profil prelazi na jedan red po disciplini sa punim nazivima i mešovitim timom.

**Architecture:** Solo je 4 nova `discipline_code`, jedan red u `results` po strelcu: K1+K2 u `qual*` (novi `qualDetail.format = "esc_solo"`), meč u `final*`, `elim*` ostaje prazno. Novi SIUS fetch u adapteru vraća spojene faze; `buildSiusImport` ih pretvara u `ReviewRow`. Profil i arhiva dobijaju mešovite redove iz `mixed_team_results` kroz isti `ResultRowData` tip, a `ResultsHistoryTable` se prepisuje na redove.

**Tech Stack:** Next.js 15 App Router, Drizzle + Supabase Postgres, Vitest, pnpm monorepo (`apps/web`, `packages/db`, `packages/adapters`).

**Spec:** `docs/superpowers/specs/2026-11-08-esc-solo-and-profile-history-design.md` (čitati uz plan). Nazivi: `docs/discipline-catalog.md`, odeljak "Nazivi u aplikaciji".

## Global Constraints

- Kodovi: `SOLOARM`, `SOLOARW`, `SOLOAPM`, `SOLOAPW` (ne smeju počinjati sa `AR`/`AP`).
- Jedina migracija: enum, `ADD VALUE IF NOT EXISTS`. Bez novih kolona.
- Solo ne ulazi u formu (`FORMA_DISCIPLINE_CODES` ga već isključuje), H2H, peak na profilu ni naslovnu.
- `NumberOfInnerTen` za Solo se ignoriše; svi Solo brojevi su celi.
- Komande: `pnpm --filter @shootermarkt/db db:generate|db:migrate|db:seed`, `pnpm --filter @shootermarkt/web test`, `pnpm --filter @shootermarkt/adapters test`, db testovi `cd packages/db && npx vitest run` (nema skripte), typecheck `cd apps/web && npx tsc --noEmit -p .`.
- Migraciju i seed na Supabase pokreće samo izvršilac posle Aleksinog "pokreni migraciju" — ne automatski.
- Commit poruke na engleskom, završavaju sa `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Profil bez pola u nazivu; puni nazivi i na telefonu, najviše dve linije naziva; bez horizontalnog skrola.

## Review Focus

1. Strelac ispao u K1 (nema K2): `qualTotal` = pogoci /30, `qualRank` = K1 rang iz SIUS-a (posle svih K2 učesnika, npr. 19+ kad je K2 gađalo 18), red se prikazuje "27 pog. #18" bez meča — test u Task 3.
2. DNS/DSQ u Solo (SIUS bez ranga): red sa `qualTotal: null`, ne puca mapiranje — test u Task 3.
3. Nerešen meč (12 : 12) — `finalRank` iz SIUS `Rank`, ne iz zbira; shoot-off oznaka u `remarkDetails.final.shootOff` — test u Task 3.
4. Mešoviti red gde partner nije povezan (`shooter2Id` null) — partner se prikazuje iz `shooter2Name` — test u Task 6.
5. Takmičenje samo sa mešovitim timom (bez pojedinačnog) mora da se pojavi u istoriji i arhivi — test u Task 6.

---

### Task 0: Komit postojeće izmene forme

Izmene su već u radnom stablu: `apps/web/src/lib/forma.ts` (`FORMA_DISCIPLINE_CODES`), `apps/web/src/lib/forma-query.ts`, `strelci/[id]/page.tsx` (`isFormaResult`), `docs/discipline-catalog.md`, spec i ovaj plan.

- [ ] **Step 1:** `pnpm --filter @shootermarkt/web test` → 127 passed.
- [ ] **Step 2:** Commit: `Limit forma to Olympic individual disciplines` (+ docs). Ne dodavati `.superpowers/`.

### Task 1: DB — kodovi, tipovi, seed, commit mapiranje

**Files:**
- Modify: `packages/db/src/schema.ts` (enum posle `STR300`; `QualDetail` unija ~:167; `BulletinFinalDetail` ~:201)
- Modify: `packages/db/src/pdf-import-types.ts` (`DisciplineCode`, `DISCIPLINE_META`, `ReviewRow`, helperi)
- Modify: `packages/db/src/discipline.ts` (`REVIEW_DISCIPLINE_CODES`, `DISTANCES` → `["10m"]`)
- Modify: `packages/db/src/seed.ts`
- Modify: `apps/web/src/lib/import-commit.ts:163-177`
- Create: `packages/db/drizzle/0045_*.sql` (generate)
- Test: `packages/db/src/pdf-import-types.test.ts`

**Interfaces:**
- Produces:
  - `ESC_SOLO_CODES = ["SOLOARM","SOLOARW","SOLOAPM","SOLOAPW"] as const`, `isEscSoloCode(code: string | null | undefined): boolean` u `pdf-import-types.ts`.
  - `EscSoloPart = { series: number[]; total: number | null; rank: number | null; remark: string | null }`; `EscSoloQualDetail = { format: "esc_solo"; part1: EscSoloPart; part2?: EscSoloPart }` u `schema.ts`, `QualDetail = SeriesQualDetail | PositionsQualDetail | EscSoloQualDetail`.
  - `BulletinFinalDetail` + `opponentTotal?: number | null; opponentName?: string | null`.
  - `ReviewRow` + `qualEscSolo?: EscSoloQualDetail; finalOpponentTotal?: number | null; finalOpponentName?: string | null`.
  - `escSoloPlacement(row: { finalRank: number | null; qualRank: number | null }): number | null`.

- [ ] **Step 1: Failing test** u `pdf-import-types.test.ts`:
```ts
it("recognizes Solo codes and derives placement", () => {
  expect(ESC_SOLO_CODES.every(isEscSoloCode)).toBe(true);
  expect(["ARM", "APMT", "SPW"].some(isEscSoloCode)).toBe(false);
  expect(qualHasDecimals("SOLOARM")).toBe(false);
  expect(isThreePositionCode("SOLOARM")).toBe(false);
  expect(escSoloPlacement({ finalRank: 2, qualRank: 1 })).toBe(2);
  expect(escSoloPlacement({ finalRank: null, qualRank: 9 })).toBe(9);
});
```
- [ ] **Step 2:** `cd packages/db && npx vitest run` → FAIL (`isEscSoloCode` not exported).
- [ ] **Step 3:** Dodati tipove/helpere iznad; `DISCIPLINE_META`: `SOLOARM {air_rifle, M, "10m vazdušna puška ESC Solo M"}`, analogno ostala tri. Enum: 4 vrednosti sa komentarom "ESC Challenge Solo — pogoci, ne ulazi u formu". Seed: `disciplines` (name "10m Air Rifle ESC Solo Men" itd., shortName "AR Solo Men", distance 10, maxQualScore "60") i varijanta po kodu `{code: "soloarm-esc", name: "ESC Solo 60 hitaca (pogoci)", totalShots: 60, maxScore: "60", hasDecimals: false, structureType: "series", structureDef: { seriesCount: 6, shotsPerSeries: 10, maxPerSeries: 10 }, qualDisplayType: "series_6", finalDisplayType: null, finalStructureDef: null, isDefault: true}`.
- [ ] **Step 4:** `import-commit.ts`: `qualDetail` = `row.qualEscSolo ?? (postojeće)`; u `finalDetail` dodati `...(row.finalOpponentTotal != null ? { opponentTotal: row.finalOpponentTotal, opponentName: row.finalOpponentName ?? null } : {})`.
- [ ] **Step 5:** `pnpm --filter @shootermarkt/db db:generate`; u generisanom SQL zameniti `ADD VALUE '` sa `ADD VALUE IF NOT EXISTS '`; proveriti da fajl sadrži samo 4 `ALTER TYPE` reda.
- [ ] **Step 6:** db testovi PASS; `cd apps/web && npx tsc --noEmit -p .` čisto (popraviti čitače `qualDetail` koji pretpostavljaju `series`/`kneeling` — `"series" in detail` provere ostaju ispravne; `format === "esc_solo"` grana tamo gde TS traži).
- [ ] **Step 7:** Commit `Add ESC Solo discipline codes and storage types`.

### Task 2: Jedan izvor naziva disciplina

**Files:**
- Create: `packages/db/src/discipline-names.ts`
- Test: `packages/db/src/discipline-names.test.ts`

**Interfaces:**
- Produces: `disciplineName(code: string, locale: string, opts?: { gender?: boolean; variant?: "3x20" | "3x40" }): string`. Nepoznat kod → vraća kod. `locale !== "en"` → srpski.

- [ ] **Step 1: Failing test:**
```ts
expect(disciplineName("ARW", "sr")).toBe("10m vazdušna puška");
expect(disciplineName("ARW", "en")).toBe("10m Air Rifle");
expect(disciplineName("APMT", "sr")).toBe("10m vazdušni pištolj miks");
expect(disciplineName("R3PM", "sr", { variant: "3x20" })).toBe("50m puška 3x20");
expect(disciplineName("R3PM", "en")).toBe("50m Rifle 3x40");
expect(disciplineName("RFPM", "sr")).toBe("25m Rapid Fire pištolj");
expect(disciplineName("SOLOAPW", "en")).toBe("10m Air Pistol ESC Solo");
expect(disciplineName("STR300", "sr")).toBe("300m standard puška");
expect(disciplineName("ARM", "sr", { gender: true })).toBe("10m vazdušna puška – seniori");
expect(disciplineName("ARW", "en", { gender: true })).toBe("10m Air Rifle Women");
expect(disciplineName("XYZ", "sr")).toBe("XYZ");
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementirati iz tabele u katalogu (svi kodovi iz `DisciplineCode` + `R3JM/R3JW` → "50m puška 3x20"); `gender` koristi `DISCIPLINE_META[code].gender` (null → bez sufiksa). R3P bez `variant` = 3x40.
- [ ] **Step 4:** PASS. **Step 5:** Commit `Add single source for discipline display names`.

### Task 3: SIUS adapter — ESC Solo fetch

**Files:**
- Modify: `packages/adapters/src/sius/public-adapter.ts`
- Create: `packages/adapters/src/sius/__fixtures__/esc-solo-arm-vroclav.json`
- Test: `packages/adapters/src/sius/public-adapter.test.ts`

**Interfaces:**
- Produces:
  - `escSoloCodeFromEvent(eventCode: string): "SOLOARM" | "SOLOARW" | "SOLOAPM" | "SOLOAPW" | null` — regex `^(AR|AP)([MW])-ECH-SOLO$`.
  - `type SiusEscSoloAthlete = { siusAthleteId: string | null; firstName: string; lastName: string; nation: string; part1: EscSoloPart; part2: EscSoloPart | null; match: { total: number; rank: number; series: number[]; opponentTotal: number | null; opponentName: string | null; shootOff: string | null } | null; qualified: boolean }`.
  - `mergeEscSoloPhases(p: { part1: SiusLiveResult[]; part2: SiusLiveResult[]; gold: SiusLiveResult[]; bronze: SiusLiveResult[] }): SiusEscSoloAthlete[]` — čista funkcija.
  - `fetchSiusEscSoloResults(compUuid: string, eventUuid: string): Promise<SiusEscSoloAthlete[]>` — `fetchSiusSubEvents` + `fetchSiusSeries(..., { includeUnranked: true })` po subeventu, prepoznavanje po imenu `/qualification part 1/i`, `/qualification part 2/i`, `/gold medal match/i`, `/bronze medal match/i`, pa `mergeEscSoloPhases`.
- Pravila spajanja: strelac se uparuje po `siusAthleteId`, pa po prezime+ime (lowercase). `part.total` = `rank === null ? null : total`; `inners` se odbacuje. `qualified` = učestvovao u meču. Protivnik u meču = drugi red istog subeventa. `match.rank` = SIUS rank reda (GMM 1/2, BMM 3/4 — BMM rang iz SIUS-a je 1/2 pa se dodaje 2).

- [ ] **Step 1: Fixture.** Preuzeti javni API (bez auth) i sačuvati sirove odgovore u jedan JSON `{ subevents, part1, part2, gold, bronze }`:
  `https://shootingsportscloud.com:8594/api/v1/pub/competitions/6d8a4737-458e-4b5e-8f01-f878cdadcda0/events/2667e9c9-3fdb-4081-bfdf-85b3738b9515/subevents` i `/series?runningCompetitionId=6d8a4737-458e-4b5e-8f01-f878cdadcda0&runningCompetitionEventId=2667e9c9-3fdb-4081-bfdf-85b3738b9515&subEventId=<id>&teamKind=Individual&shooterGroup=Regulars` za K1 `76875d2d-87a2-441f-ada4-8f7520888440`, K2 `2835ac8e-b61a-441f-86ac-47637d63f374`, BMM `923776f9-f39f-4533-a6e4-61053d4a74d5`, GMM `f608999c-e191-4ec3-a928-6c2cfee7a361`.
- [ ] **Step 2: Failing testovi** (fixture kroz `vi.stubGlobal("fetch", …)` vraća sačuvane odgovore po URL-u):
```ts
it("maps ESC Solo event codes", () => {
  expect(escSoloCodeFromEvent("ARM-ECH-SOLO")).toBe("SOLOARM");
  expect(escSoloCodeFromEvent("APW-ECH-SOLO")).toBe("SOLOAPW");
  expect(escSoloCodeFromEvent("ARM")).toBeNull();
});
it("merges Vroclav Solo phases per athlete", async () => {
  const rows = await fetchSiusEscSoloResults(COMP, EVENT);
  expect(rows).toHaveLength(31);
  const aleksa = rows.find((r) => r.lastName === "RAKONJAC")!;
  expect(aleksa.part2).toMatchObject({ total: 52, rank: 1 });
  expect(aleksa.match).toMatchObject({ total: 10, rank: 2, opponentTotal: 12, opponentName: "LINDGREN Victor" });
  expect(aleksa.part1.series).toHaveLength(3);
  expect(rows.filter((r) => r.part2).length).toBe(18);
  expect(rows.filter((r) => r.match).length).toBe(4);
  const out = rows.find((r) => !r.part2)!;
  expect(out.part1.total).toBeLessThanOrEqual(30);
});
it("takes match rank from SIUS on a tie and keeps the shoot-off mark", () => {
  const tie = mergeEscSoloPhases({ part1: [P1A, P1B], part2: [], gold: [{ ...MATCH_A, total: 12, rank: 2 }, { ...MATCH_B, total: 12, rank: 1, shootOff: "SO" }], bronze: [] });
  expect(tie.find((r) => r.lastName === "B")!.match).toMatchObject({ rank: 1, shootOff: "SO" });
  expect(tie.find((r) => r.lastName === "A")!.match).toMatchObject({ rank: 2, opponentTotal: 12 });
});
it("keeps a DNS athlete with null totals", () => {
  const [row] = mergeEscSoloPhases({ part1: [{ ...P1A, rank: null, total: 0, remark: "DNS" }], part2: [], gold: [], bronze: [] });
  expect(row.part1).toMatchObject({ total: null, rank: null, remark: "DNS" });
});
```
(`P1A`, `P1B`, `MATCH_A`, `MATCH_B` su mali `SiusLiveResult` literali u testu, prezimena "A" i "B".) Ako stvarni broj K2 redova ili protivnikovo ime u fixture-u odstupa od očekivanog, verovati fixture-u i ispraviti očekivanje.
- [ ] **Step 3:** FAIL. **Step 4:** Implementirati. **Step 5:** `pnpm --filter @shootermarkt/adapters test` PASS.
- [ ] **Step 6:** Commit `Fetch ESC Solo phases from SIUS public API`.

### Task 4: SIUS import + admin review za Solo

**Files:**
- Modify: `apps/web/src/lib/sius-import.ts`
- Modify: `apps/web/src/app/(site)/(admin)/admin/rezultati/modes/SiusMode.tsx:18,188`
- Modify: `apps/web/src/app/(site)/(admin)/admin/rezultati/_shared/ReviewTable.tsx:235-300`
- Test: `apps/web/src/lib/sius-import.test.ts` (create ako ne postoji)

**Interfaces:**
- Consumes: Task 1 `ReviewRow.qualEscSolo`, `finalOpponent*`; Task 3 `fetchSiusEscSoloResults`, `escSoloCodeFromEvent`, `SiusEscSoloAthlete`.
- Produces: `escSoloReviewRows(athletes: SiusEscSoloAthlete[], code: EscSoloCode, category: AgeCategory, match: (first, last, noc) => number | undefined): ReviewRow[]` (izvesti iz `sius-import.ts`, čista).

Mapiranje (spec, tabela "Skladištenje"): `qualTotal` = `part2?.total ?? part1.total`; `qualRank` = `part2?.rank ?? part1.rank` (za ispale bez K2: `part1.rank` iz SIUS-a; prolaz se nikad ne računa po broju 16 — K2 učesnik je ko postoji u K2 rezultatima); `qualified` = `match != null`; `qualEscSolo = { format: "esc_solo", part1, part2 }` (part2 izostavljen kad je null); `remark` = `part2?.remark ?? part1.remark`; `finalTotal/finalRank/finalSeries` iz `match`, `finalScoring: "hit_count"`, `finalOpponentTotal/Name`; `match.shootOff` → `remarkDetails.final.shootOff`. `elim*` se ne postavljaju. Kategorija: Solo event kod se prvo prevodi `escSoloCodeFromEvent`, kategorija `senior` (juniorske Solo kodove ne nagađati; nepoznat Solo kod ide u `errors`).

- [ ] **Step 1: Failing test:**
```ts
const rows = escSoloReviewRows([ALEKSA, OUT_IN_K1], "SOLOARM", "senior", () => 7);
expect(rows[0]).toMatchObject({ disciplineCode: "SOLOARM", qualTotal: 52, qualRank: 1, qualified: true, finalTotal: 10, finalRank: 2, finalScoring: "hit_count", finalOpponentTotal: 12, shooterId: 7 });
expect(rows[0].elimTotal).toBeUndefined();
expect(rows[0].qualEscSolo?.part2?.total).toBe(52);
expect(rows[1]).toMatchObject({ qualTotal: 27, qualRank: 20, qualified: false, finalTotal: null });
expect(rows[1].qualEscSolo?.part2).toBeUndefined();
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementirati `escSoloReviewRows`; u `buildSiusImport` Solo eventi (`escSoloCodeFromEvent(e.eventCode) != null`) se uzimaju iz `fetchSiusEvents` i obrađuju posebno (ne kroz `fetchLiveSiusResults`), redovi idu u isti `rows` niz. `SiusMode` `SUPPORTED_CODES` dodaje `"ARM-ECH-SOLO","ARW-ECH-SOLO","APM-ECH-SOLO","APW-ECH-SOLO"`.
- [ ] **Step 4:** `ReviewTable`: kad su redovi Solo (`isEscSoloCode`), umesto `QualificationTable`/`FinalsTable` prikazati `EscSoloReviewTable` (u istom fajlu): kolone Rang | Strelac | K1 (serije, ukupno) | K2 (serije, ukupno, rang) | Meč (X : Y, mesto). Samo prikaz + postojeći `ShooterMatchCell` za povezivanje strelca.
- [ ] **Step 5:** web testovi + tsc PASS. **Step 6:** Ručno: u adminu SIUS mod, UUID `6d8a4737-458e-4b5e-8f01-f878cdadcda0`, izabrati `ARM-ECH-SOLO`, review pokazuje 31 red (bez commit-a dok Aleksa ne kaže).
- [ ] **Step 7:** Commit `Import ESC Solo results through SIUS mode`.

### Task 5: Solo van poređenja skorova

**Files:**
- Modify: `apps/web/src/app/api/h2h/route.ts:33`
- Modify: `apps/web/src/app/(site)/[locale]/(public)/[scope]/strelci/[id]/page.tsx:135-145` (`finalesCount`, `peakResult`)
- Modify: `apps/web/src/lib/homepage-data.ts` (upiti za live i nedavne rezultate po disciplini)

- [ ] **Step 1:** H2H: dodati `notInArray(disciplines.code, [...ESC_SOLO_CODES])` u `where`.
- [ ] **Step 2:** Profil: `finalesCount` i `peakResult` računati samo iz redova gde `!isEscSoloCode(r.disciplineCode)`; `totalAppearances` ostaje broj takmičenja (vidi Task 6 — uključuje mešovite).
- [ ] **Step 3:** Naslovna: isti `notInArray` filter u upitima koji biraju top-3 po disciplini.
- [ ] **Step 4:** tsc + web testovi PASS. **Step 5:** Commit `Keep ESC Solo out of score comparisons`.

### Task 6: Podaci istorije — mešoviti tim na profilu i u arhivi

**Files:**
- Modify: `apps/web/src/components/result-display/ResultsHistoryTable.tsx:28-54` (tip)
- Create: `apps/web/src/lib/shooter-mixed-results.ts`
- Modify: `apps/web/src/lib/shooter-results.ts`
- Modify: `apps/web/src/app/(site)/[locale]/(public)/[scope]/strelci/[id]/page.tsx:64-150`
- Test: `apps/web/src/lib/shooter-mixed-results.test.ts`

**Interfaces:**
- Produces:
  - `ResultRowData` + `rowKey: string` (`"r:<id>"` / `"m:<id>"`), `kind: "individual" | "mixed" | "esc"`, `partnerName?: string | null`, `mixedDetail?: { own: { series: number[]; total: number } | null; partner: { series: number[]; total: number } | null } | null`. `kind` za `results` redove = `isEscSoloCode ? "esc" : "individual"`.
  - `toMixedHistoryRow(row: MixedRowInput, shooterId: number): ResultRowData` — čista; `MixedRowInput` = selekcija iz `mixed_team_results` + `competitions`/`countries` + imena povezanih strelaca. Partner: drugi slot; ime iz `shooters` (Ime Prezime → "I. Prezime") ako je povezan, inače `shooterXName`.
  - `getShooterMixedRows(shooterId: number, competitionIds?: number[]): Promise<ResultRowData[]>` — `or(eq(shooter1Id), eq(shooter2Id))`.
  - `getShooterHistoryCompetitionIds(shooterId, opts: { cursor?: ResultsCursor; filters?: ResultsFilters; limit: number }): Promise<Array<{ id: number; date: string }>>` — distinct takmičenja iz `results` ∪ `mixed_team_results`, sort `date desc, id desc`, `limit + 1`.

- [ ] **Step 1: Failing test:**
```ts
const row = toMixedHistoryRow({ id: 5, shooter1Id: 10, shooter2Id: null, shooter1Name: "RAKONJAC Aleksa", shooter2Name: "PETROVIĆ Žaklina", qualTotal: "629.1", qualRank: 6, finalRank: null, finalTotal: null, shooter1Detail: { series: [105.1], total: 315.2 }, shooter2Detail: { series: [104.9], total: 313.9 }, partnerFirstName: null, partnerLastName: null, disciplineCode: "ARMT", ...COMP }, 10);
expect(row).toMatchObject({ rowKey: "m:5", kind: "mixed", partnerName: "Ž. Petrović", qualTotal: "629.1", qualRank: 6, disciplineCode: "ARMT" });
expect(row.mixedDetail?.own?.total).toBe(315.2);
```
plus test da se takmičenje samo sa mešovitim redom vraća iz `getShooterHistoryCompetitionIds` (mock `db` po obrascu postojećih testova u `apps/web/src/lib`; ako takav obrazac ne postoji, testirati čistu funkciju `mergeCompetitionIds(a, b, limit)` koju `getShooterHistoryCompetitionIds` koristi).
Partner iz `shooterXName` u SIUS formatu "PREZIME Ime" → "Ime" inicijal + prezime u title case ("Ž. Petrović"); koristiti postojeći `splitDisplayName` logiku iz adaptera ako je dostupna kroz paket, inače lokalno.
- [ ] **Step 2:** FAIL. **Step 3:** Implementirati. `shooter-results.ts` koristi `getShooterHistoryCompetitionIds` i spaja `results` redove (sa `rowKey`, `kind`) i `getShooterMixedRows(shooterId, ids)`. Profil: poslednjih 5 takmičenja iz istog izvora (`limit: 5`), mešoviti redovi uključeni; `totalAppearances` = broj distinct takmičenja (pojedinačno + mešoviti).
- [ ] **Step 4:** testovi + tsc PASS (`ResultsHistoryTable.test.tsx` i `ShooterResultsArchive.test.tsx` fixture-i dobijaju `rowKey`/`kind`).
- [ ] **Step 5:** Commit `Load mixed team results into shooter history`.

### Task 7: ResultsHistoryTable — jedan red po disciplini

**Files:**
- Modify: `apps/web/src/components/result-display/ResultsHistoryTable.tsx`
- Test: `apps/web/src/components/result-display/ResultsHistoryTable.test.tsx`

**Interfaces:**
- Consumes: Task 2 `disciplineName`, Task 6 `ResultRowData` polja, Task 1 `escSoloPlacement`, `EscSoloQualDetail`.
- Produces: `sortHistoryRows(rows: ResultRowData[]): ResultRowData[]` (izvezena) — unutar takmičenja `individual` (po redosledu `DISCIPLINE_ORDER` iz `CompetitionResultsClient`, premestiti ga u `packages/db/src/discipline-names.ts` kao `DISCIPLINE_DISPLAY_ORDER`) → `mixed` → `esc`.

Zadržava se: grupisanje po takmičenju, zaglavlje, filter po disciplini (dugmad sa `disciplineName`), accordion sa `ResultDetailPanel`, `MEDAL_COLOR`, `qualHasDecimals`. Briše se: `grid-cols-2` / `singleCol` logika. Expand ključ = `rowKey`.

Red (spec "Profil"): desktop `sm:grid-cols-[1fr_160px_110px_120px]` (naziv | dodatak | kval `#rang` | finale/meč); telefon dve linije: gore naziv + kval, dole dodatak + finale/meč (`text-[11px]`, muted). Dodatak: individual → `CATEGORY_LABEL` ako nije `senior`; mixed → `sa ${partnerName}` / `with …`; esc → "ESC Challenge". Solo: kval = `${qualTotal} pog.` / `hits`, desno medalja + `meč 10 : 12` (`match 10 : 12`) iz `finalDetail.opponentTotal`, + " SO" ako `remarkDetails.final.shootOff`; bez meča → `${escSoloPlacement}. mesto` / `${n}th`. R3P naziv: `variant` iz broja serija u `qualDetail` (6 → 3x20, inače 3x40). Mixed expand: mali panel sa dve kolone serija (`mixedDetail.own`/`partner`); Solo expand: K1 i K2 serije.

- [ ] **Step 1: Failing testovi** (RTL, postojeći obrazac u fajlu):
```ts
it("orders individual, mixed, then ESC rows inside a competition", () => {
  expect(sortHistoryRows([SOLO, MIXED, ARM]).map((r) => r.kind)).toEqual(["individual", "mixed", "esc"]);
});
it("renders full discipline names, partner and Solo match", () => {
  render(<ResultsHistoryTable results={[ARM, MIXED, SOLO]} locale="sr" />);
  expect(screen.getByText("10m vazdušna puška")).toBeInTheDocument();
  expect(screen.getByText("10m vazdušna puška miks")).toBeInTheDocument();
  expect(screen.getByText("sa Ž. Petrović")).toBeInTheDocument();
  expect(screen.getByText("10m vazdušna puška ESC Solo")).toBeInTheDocument();
  expect(screen.getByText(/meč 10 : 12/)).toBeInTheDocument();
  expect(screen.queryByText("ARM")).not.toBeInTheDocument();
});
it("shows placement for a Solo shooter out after qualification 1", () => {
  render(<ResultsHistoryTable results={[SOLO_OUT]} locale="sr" />);
  expect(screen.getByText(/27 pog\./)).toBeInTheDocument();
  expect(screen.getByText(/18\. mesto/)).toBeInTheDocument();
});
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementirati (pre UI izmena pročitati `~/.claude/skills/impeccable/reference/craft-floor.md`; vizuelni jezik ostaje postojeći: tokeni `var(--ink|muted|subtle|border|surface)`, fontovi Barlow Condensed / JetBrains Mono kao sada).
- [ ] **Step 4:** testovi + tsc PASS.
- [ ] **Step 5: Vizuelna provera** (jedan batch): `pnpm --filter @shootermarkt/web dev`, profil strelca sa ARM + ARMT na istom takmičenju, 375px i 1280px screenshot; nema trećeg reda naziva ni horizontalnog skrola. Ispraviti sve u jednom prolazu, najviše još jedna provera.
- [ ] **Step 6:** Commit `Show shooter history as one row per discipline`.

### Task 8: Stranica takmičenja — Solo prikaz

**Files:**
- Create: `apps/web/src/components/result-display/EscSoloResults.tsx`
- Modify: `apps/web/src/app/(site)/[locale]/(public)/[scope]/takmicenja/[id]/CompetitionResultsClient.tsx` (`DISCIPLINE_NAMES` → `disciplineName`, `DISCIPLINE_ORDER` → `DISCIPLINE_DISPLAY_ORDER` sa Solo na kraju, `disciplineFamily`: `SOLOAR*` → airRifle, `SOLOAP*` → airPistol; render grana za Solo)
- Test: `apps/web/src/components/result-display/EscSoloResults.test.tsx`

**Interfaces:**
- Consumes: redovi koje stranica već učitava iz `results` (sa `qualDetail`, `finalDetail`, imenima, NOC); Task 1 tipovi.
- Produces: `<EscSoloResults results={rows} locale={locale} />`.

Prikaz (spec "Stranica takmičenja"): rečenica pravila ("Pogodak: 10.3 i više" za AR / "9.8 i više" za AP; en "Hit: 10.3 or higher"), zatim **Mečevi za medalju** (Zlato, Bronza: dva strelca, `X : Y`, pobednik istaknut), **Kvalifikacija 2** (redovi sa `part2`, sort po `part2.rank`: rang, strelac, 6 serija, ukupno, `QG`/`QB` za 1–2/3–4), **Kvalifikacija 1** (svi, sort po `part1.rank`: rang, strelac, 3 serije, ukupno, `Q` za top 16). Celi brojevi. Solo disciplina nema Q/E/F tabove — jedna stranica sa tri sekcije.

- [ ] **Step 1: Failing test:**
```ts
render(<EscSoloResults results={VROCLAV_ROWS} locale="sr" />);
expect(screen.getByText("Pogodak: 10.3 i više")).toBeInTheDocument();
expect(screen.getByRole("heading", { name: "Mečevi za medalju" })).toBeInTheDocument();
expect(within(screen.getByTestId("gold-match")).getByText("12 : 10")).toBeInTheDocument();
expect(within(screen.getByTestId("qual2")).getAllByRole("row")).toHaveLength(18 + 1);
expect(within(screen.getByTestId("qual1")).getAllByRole("row")).toHaveLength(31 + 1);
```
(`VROCLAV_ROWS` = redovi izvedeni iz Task 3 fixture-a kroz Task 4 `escSoloReviewRows`, oblikovani kao red stranice takmičenja.)
- [ ] **Step 2:** FAIL. **Step 3:** Implementirati. **Step 4:** testovi + tsc PASS.
- [ ] **Step 5: Vizuelna provera** u istom batch-u kao Task 7 kad je moguće (posle uvoza Vroclava na lokalnu/test bazu nije dostupno bez commit-a → koristiti test render ili privremeni seed samo lokalno, ne na Supabase).
- [ ] **Step 6:** Commit `Show ESC Solo matches and qualification on competition page`.

### Task 9: Završna provera

- [ ] `pnpm --filter @shootermarkt/web test`, `pnpm --filter @shootermarkt/adapters test`, `cd packages/db && npx vitest run`, tsc u `apps/web`, `packages/db`, `packages/adapters` — sve PASS.
- [ ] `pnpm --filter @shootermarkt/web db:backtest-forma` — MAE nepromenjen (forma sada ograničena; podaci isti).
- [ ] Pitati Aleksu za `pokreni migraciju` (0045 + seed), pa uvoz Vroclav Solo-a kroz admin.
