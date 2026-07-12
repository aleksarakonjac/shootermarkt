# Code Quality Backlog

Status snapshot: 2026-07-12

Ovaj dokument je radni backlog za greške, upozorenja i tehnički dug pronađen
tokom provere aplikacije. Svaka stavka ima checkbox kako bi se napredak beležio
u istom fajlu.

## Pravila rada

- Pre početka stavke promeniti status iz `[ ]` u `[-]`.
- Po završetku označiti `[x]`, upisati datum i kratku napomenu u "Progress log".
- Za svaku izmenu pokrenuti najmanje ciljane testove i `pnpm run build` kada se
  dira React/Next kod.
- Ne gasiti ESLint pravila samo da bi provera prošla; ispraviti uzrok ili jasno
  obrazložiti izuzetak uz lokalni komentar.

## Trenutno stanje

| Provera | Stanje | Napomena |
| --- | --- | --- |
| `pnpm run build` | prolazi | Next.js kompilacija, TypeScript i statičke stranice prolaze. |
| Ciljani unit testovi | prolaze | Forma i CMS block testovi prolaze. |
| `pnpm test` | prolazi | 16 test fajlova prolazi; 3 Payload integraciona testa su preskočena bez test baze. |
| `pnpm lint` | ne prolazi | 91 greška i 41 upozorenje u aktivnom kodu u trenutnom snapshot-u. |

## P0 - Test infrastruktura

### Payload integracioni test nema dostupnu bazu

- [-] Obezbediti zaseban, pristupačan `CMS_TEST_DATABASE_URL` za Payload
  integracione testove. Ne koristiti produkcionu bazu za test podatke.
  - Blokirano 2026-07-12: promenljiva nije podešena u lokalnom okruženju.
- [x] Podesiti `src/cms/collections/Articles.access.test.ts` da koristi samo taj
  test URL i da se preskoči kada promenljiva nije podešena.
  - Urađeno 2026-07-12.
- [x] Dodati posebnu komandu `pnpm test:integration` za testove koji
  menjaju bazu; `pnpm test` treba da ostane brz i deterministički unit suite.
  - Urađeno 2026-07-12; komanda jasno prekida rad ako URL nije podešen.
- [ ] Nakon podešavanja potvrditi da `Articles.access.test.ts` prolazi bez
  timeout-a pri `begin transaction` i tokom cleanup-a.

### Izolacija testova i generisanih kopija

- [x] Isključiti `.claude/worktrees/**` iz Vitest pretrage.
  - Urađeno 2026-07-12 u `vitest.config.ts`.
- [x] Isključiti `.claude/worktrees/**` iz ESLint pretrage.
  - Urađeno 2026-07-12 u `eslint.config.mjs`.
- [x] Mockovati `@/i18n/navigation` u `ArticleContent.test.tsx` da test ne
  zavisi od Next.js ESM rezolucije `next/navigation`.
  - Urađeno 2026-07-12.
- [x] Zaštititi Payload cleanup kada inicijalizacija testa ne uspe.
  - Urađeno 2026-07-12 u `Articles.access.test.ts`.

## P1 - React greške koje blokiraju ESLint

### Sinhroni `setState` unutar efekata

Ove stavke treba rešavati izvedenim stanjem, event handlerima, `useSyncExternalStore`
ili asinhronim callback-ovima, zavisno od slučaja. Ne menjati ponašanje UI-ja bez
provere odgovarajućeg toka.

- [x] `src/components/shooter/FormaChart.tsx`
  - Prebačeno na izvedeni pomak prozora i `useSyncExternalStore` za viewport.
  - Urađeno 2026-07-12.
- [ ] `src/app/(site)/(admin)/admin/rezultati/_shared/ShooterMatchCell.tsx`
  - Pretraga strelaca resetuje rezultate sinhrono u efektu.
- [ ] `src/app/(site)/(admin)/admin/rezultati/modes/ManualMode.tsx`
  - Sinhronizacija discipline, serija i rangova menja redove iz više efekata.
  - Potrebno je objediniti transformacije redova ili ih pokrenuti iz događaja
    koji menjaju disciplinu/podatke.
- [ ] `src/app/(site)/(admin)/admin/rezultati/modes/PdfImportJobsPanel.tsx`
  - Početno učitavanje menja `loading` i `error` sinhrono u efektu.
- [ ] `src/app/(site)/[locale]/(public)/[scope]/takmicenja/[id]/CompetitionResultsClient.tsx`
  - Aktivna kategorija se popravlja efektom kada više ne postoji u grupi.
- [ ] `src/app/(site)/[locale]/(public)/components/MainNav.tsx`
  - Zatvaranje menija na promeni rute i memoizacija `openGlobalSearch`.
- [ ] `src/app/(site)/[locale]/(public)/components/PageTransitionOverlay.tsx`
  - `mounted` stanje se postavlja odmah po mount-u.
- [ ] `src/app/(site)/[locale]/(public)/components/ThemeToggle.tsx`
  - Inicijalizacija teme i `mounted` stanja iz localStorage-a.
- [ ] `src/app/(site)/[locale]/(public)/ticker.tsx`
  - Reset indeksa pri promeni broja ticker stavki.
- [ ] `src/components/ui/DateTimePicker.tsx`
  - Sinhronizacija sata i minuta sa `value` prop-om.
- [ ] `src/components/ui/ShooterSearchSelect.tsx`
  - Reset udaljenih rezultata i selektovanog strelca.

### Interna navigacija preko `<a>` umesto `Link`

- [ ] Zameniti interne admin linkove sa `next/link` ili odgovarajućim lokalnim
  `Link` komponentama u svim prijavljenim fajlovima.
- [ ] Početi od sledećih fajlova:
  - `admin/import/import-client.tsx`
  - `admin/issf/issf-import-client.tsx`
  - `admin/rezultati/_shared/DonePanel.tsx`
  - `admin/rezultati/modes/PdfMode.tsx`
  - `admin/rezultati/modes/SssMode.tsx`
  - `admin/sius/sius-import-client.tsx`
  - `admin/strelci/[id]/shooter-admin-client.tsx`
  - `admin/strelci/novi/shooter-form-client.tsx`
  - `admin/takmicenja/[id]/edit/competition-edit-client.tsx`
  - `admin/takmicenja/novi/competition-form-client.tsx`

### Mutacija tokom React rendera

- [ ] `src/components/result-display/ArApFinalDisplay.tsx`
  - Izračunati kumulativne rezultate bez menjanja lokalne promenljive tokom
    `map`, npr. preko `reduce` ili prethodno izračunatog niza.
- [ ] `src/components/result-display/PositionsFinalDisplay.tsx`
  - Ista korekcija kao za AR/AP finale.

### React Compiler / struktura komponenti

- [ ] `src/app/(site)/[locale]/(public)/components/MainNav.tsx`
  - Popraviti dependency niz za `openGlobalSearch` ili ukloniti nepotreban
    `useCallback`.
- [ ] `src/app/(site)/[locale]/(public)/[scope]/strelci/page.tsx`
  - Izdvojiti `SortIcon` iz tela render funkcije.

## P2 - Tipovi, semantika i upozorenja

- [ ] Ukloniti `any` iz:
  - `src/app/(site)/[locale]/(public)/[scope]/vesti/page.tsx`
  - `src/app/(site)/[locale]/(public)/ticker.tsx`
- [ ] Escape-ovati navodnike u `search-bar-client.tsx` (`react/no-unescaped-entities`).
- [ ] Pregledati `no-unused-expressions` u import tokovima i tabelama rezultata:
  - `SiusMode.tsx`, `SssMode.tsx`, `sius-import-client.tsx`
  - `CompetitionFinalTable.tsx`, `ResultsHistoryTable.tsx`
- [ ] Ukloniti neiskorišćene import-e i promenljive koje ESLint prijavljuje u
  API rutama, skriptama i javnim stranicama.
- [ ] Procena `<img>` upozorenja u `RegionSelector.tsx`; koristiti `next/image`
  samo ako zastavice/izvori podržavaju stabilne dimenzije i optimizaciju.

## P3 - Nakon prvog cleanup-a

- [ ] Pokrenuti `pnpm lint` i ažurirati broj preostalih grešaka u tabeli iznad.
- [ ] Pokrenuti `pnpm test` sa dostupnom test bazom.
- [ ] Pokrenuti `pnpm run build` pre commita.
- [ ] Dodati ciljane testove za svaku izmenu koja menja ponašanje, naročito za
  import forme, navigaciju i prikaz finala.

## Progress log

| Datum | Stavka | Status | Napomena / verifikacija |
| --- | --- | --- | --- |
| 2026-07-12 | FormaChart React cleanup | završeno | Ciljani ESLint i `pnpm run build` prolaze. |
| 2026-07-12 | Izolacija `.claude/worktrees` | završeno | Vitest i ESLint više ne izvršavaju stare radne kopije. |
| 2026-07-12 | CMS `ArticleContent` test navigacije | završeno | Test prolazi sa lokalnim i18n mock-om. |
| 2026-07-12 | Payload integration test izolacija | delimično | `CMS_TEST_DATABASE_URL` nije podešen; suite se preskače u `pnpm test`, a `pnpm test:integration` ga zahteva. |
| 2026-07-12 | Osnovni test suite | završeno | `pnpm test`: 16 fajlova prolazi, 1 integration fajl i 3 testa su preskočena. |
| YYYY-MM-DD | Opis sledeće stavke | u toku / završeno | Komanda i rezultat provere. |
