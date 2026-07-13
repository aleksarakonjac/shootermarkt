# Code Quality Backlog

Status snapshot: 2026-07-13

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
| `pnpm run build` | lokalno blokiran | Kompilacija i TypeScript prolaze; lokalni Supabase host trenutno ne može da se razreši pri prerenderovanju. |
| `pnpm test` | prolazi | 16 test fajlova i 40 testova prolazi; 3 Payload integraciona testa su preskočena bez test baze. |
| `pnpm lint` | prolazi | Nema grešaka ni upozorenja. |

## Revalidacija kvaliteta

- [x] Aktivni ESLint kvalitet gate je očišćen 2026-07-13.
  - Uklonjena su preostala tri neiskorišćena importa iz pomoćnih skripti.
  - `pnpm lint` prolazi bez izlaza.
- [x] Unit test suite je ponovo proverен 2026-07-13.
  - `pnpm test`: 40 prolaznih i 3 namerno preskočena Payload integration testa.
- [x] P1/P2 stavke ispod su revalidirane pod trenutnim ESLint pravilima.
  - Prethodni React Compiler i strogi React hook nalazi iz snapshot-a 2026-07-12
    više nisu aktivne ESLint prijave u trenutnoj konfiguraciji. Zadržani su kao
    istorijski spisak za slučaj da se ta pravila ponovo uključe.

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

- [x] Pokrenuti `pnpm lint` i ažurirati broj preostalih grešaka u tabeli iznad.
- [x] Pokrenuti `pnpm test` bez Payload integration testa.
- [-] Pokrenuti `pnpm run build` pre commita.
  - Blokirano lokalnim DNS pristupom Supabase pooler hostu pri prerenderovanju;
    kompilacija i TypeScript faza prolaze.
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
| 2026-07-13 | Aktivni lint cleanup | završeno | `pnpm lint` prolazi bez grešaka i upozorenja. |
| 2026-07-13 | Revalidacija test suite-a | završeno | 40 testova prolazi, 3 Payload integration testa namerno preskočena. |
| YYYY-MM-DD | Opis sledeće stavke | u toku / završeno | Komanda i rezultat provere. |
