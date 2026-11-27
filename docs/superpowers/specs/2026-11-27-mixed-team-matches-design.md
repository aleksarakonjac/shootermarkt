# Mešoviti timovi: zaseban meč, datum i veza sa profilima

Datum: 2026-11-27 · Status: čeka odobrenje · izabran pristup 1, timovi dobijaju svoj meč

## Zašto

Mešoviti timovi (`mixed_team_results`, ARMT/APMT) nemaju meč ni datum. Sajt datum uzima samo iz satnice, pa
uvezeni timovi bez satnice nemaju datum (Salona: satnica upisana ručno). Takmičenje ne može da čuva dva meča
mik timova iste discipline: SIUS uvoz drugi meč preskače („drugi meč nije uvezen“), PDF uvoz isto. Uvoz iz
admina (SIUS, PDF) upisuje samo imena članova, pa tim ne postoji na profilu strelca (profil traži po vezi).

**Uspeh:** mik tim pripada meču takmičenja kao pojedinačni rezultat (naziv + datum), dva meča iste discipline
mogu da postoje, a člana tima koji postoji u bazi tim prikazuje na njegovom profilu.

**Anti-ciljevi:** ne gubi se nijedan postojeći tim; ne prave se duplikati strelaca; postojeći uvozi i live cron
rade kao pre za takmičenja sa jednim mečem.

## Pristupi (izabran 1)

1. **Veza na meč, kao kod pojedinačnih (izabran).** `competition_event_id` na `mixed_team_results`, isti
   `competition_events`. Rešava datum i više mečeva istim mehanizmom koji pojedinačni već koriste.
2. Samo kolona `date` — brže, ali drugi meč i dalje ne može da se uveze.
3. Uvoz sam upisuje satnicu — bez izmene baze, ali izmišljeni termini idu u satnicu, ticker i live prikaz.

## Dizajn

### Baza (migracija)
- `mixed_team_results.competition_event_id integer null references competition_events(id)`.
- Unique index `(competition_id, discipline_id, category, noc_code, team_number)` → zamenjuje ga
  `(competition_id, competition_event_id, discipline_id, category, noc_code, team_number) NULLS NOT DISTINCT`
  (isto kao `results_shooter_comp_event_disc_cat_unique`). Postojeći redovi ostaju sa `null` = glavni meč.
- Migracija se generiše (`db:generate`), proverava na kopiji/dev bazi; na produkciji se pokreće tek uz odobrenje.

### Upis (`lib/import-commit-mixed.ts`)
- `MixedCommitInput` dobija `eventName` / `eventDate`; event se pravi preko `ensureCompetitionEvent`
  (kao `import-commit.ts`). `onConflictDoUpdate` target i `loadTeams`/`previewMixedTeams` uključuju event.
- `MixedTeamEntry` dobija `eventName?` / `eventDate?`; `commitMixedStages` grupiše po
  disciplina + kategorija + event (oba klijenta: browser `commitMixedTeams` i serverski `commitMixedTeamsDirect`).
- **Veza sa profilima:** pri upisu kvalifikacija svaki član se traži `matchShooter` (ime, prezime, država tima)
  nad strelcima iz baze, isto pravilo kao `commitImportReview`; samo `kind === "exact"` se upisuje u
  `shooter1Id`/`shooter2Id`. Postojeća veza se ne briše (`coalesce`, kao u live cron-u). Novi strelci se ne prave.

### Uvoz
- **PDF:** parser timu daje datum njegovih strana (`F…/Q…TA DDMMYY`) i naziv meča sa njih; dva datuma iste
  discipline su dva meča (ukida se upozorenje „drugi meč nije uvezen“).
- **PDF pregled — timovi imaju svoj meč (odluka korisnika 2026-11-27).** Jedan meč čuva jedan datum, a timovi
  znaju da pucaju drugog dana od pojedinačnih istog meča (Salona: Trophy pojedinačno 22–24.10, timovi 23.10).
  Zato blok „Mešoviti timovi“ ima svoju kvačicu „zaseban meč“ sa poljima naziv i datum, nezavisno od kvačice
  pojedinačnih. Uključivanjem se popunjava: datum iz biltena, naziv = naziv meča pojedinačnih (ako je upisan)
  + „ · mešoviti timovi“. Oba polja su obavezna kao kod pojedinačnih.
- **SIUS (admin i period):** `buildSiusImport` drugi meč mik tima više ne preskače — dobija
  `matchEventName(match, date)` kao pojedinačni.
- **Live cron:** ostaje glavni meč (`null`), samo `onConflictDoUpdate` target i merge ključ dobijaju event.
- **ISSF i ručni unos:** bez promene ponašanja (glavni meč); prolaze kroz isti upis pa dobijaju vezu sa profilima.

### Prikaz
- Stranica takmičenja: mik grupe po disciplina + kategorija + event; datum = datum eventa → satnica → ništa;
  dva meča iste discipline su dva bloka, sa nazivom meča kao kod pojedinačnih.
- Profil/istorija strelca (`lib/shooter-mixed-results.ts`, `lib/shooter-results.ts`): datum eventa umesto
  datuma takmičenja kad postoji, i naziv meča uz takmičenje.
- Admin rezultati takmičenja: mik grupe po eventu; brisanje po eventu kao kod pojedinačnih.
  **Bitno:** čišćenje praznih `competition_events` posle brisanja mora da proveri i `mixed_team_results`.

## Odluke izvođača (moje)
- Kvačica „zaseban meč“ za timove je podrazumevano isključena (glavni meč, kao do sada); kad su pojedinačni
  označeni kao zaseban meč a timovi nisu, pregled to napomene.
- SIUS: meč mik tima se imenuje po svom datumu (`matchEventName`), pa se sa pojedinačnima istog dana spaja u
  isti event, a drugog dana dobija svoj.
- Grupisanje mik timova u pregledu PDF uvoza po meču: jedan blok po disciplini + meču.
- Razlika pri ponovnom uvozu (pregled novo/izmenjeno) poredi timove po eventu.
- Homepage, focus-plan, admin-todo, discipline-groups: rade po takmičenju, ne treba ih menjati (proveriti testom/grep-om).

## Van obima
- Ručni unos mik timova sa zasebnim mečom.
- Pravljenje novih strelaca iz članova tima.
- Live cron sa više mečeva mik timova.

## Provera
- Testovi: upis tima u event, dva meča iste discipline, veza sa profilom (exact da, suggestion ne), čišćenje eventa.
- Salona PDF: sa kvačicom za timove 36 timova u meču „Salona Trophy 2026 · mešoviti timovi“ sa datumom 23.10,
  članovi iz baze povezani; bez kvačice u glavnom meču kao do sada.
- Postojeći bilteni (kup, memorijal, Šamorin SIUS pregled) daju isti rezultat.
