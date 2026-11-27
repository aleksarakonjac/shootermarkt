# Ekipni rezultati iz biltena

Datum: 2026-11-27 · Status: odobren 2026-11-27

## Namera

Domaća i druga takmičenja bez online rezultata treba da budu na sajtu isti dan, dan po dan, sa **svim**
rezultatima iz biltena, bez čekanja da savez objavi kompletan bilten. Danas nedostaje ekipni plasman,
a miks tim gubi ime kluba. Prvi slučaj: Walther Youth Cup, Smederevo (miks puška junior; pištolj
pojedinačno U16/U18/U21, meč 1, sa ekipnim plasmanom; poseban PDF po disciplini).

## Ciljevi

1. SIUS PDF uvoz čita klupske ekipne liste.
2. Plasman, zbir i sastav se preuzimaju iz biltena. Sajt ništa ne računa.
3. Na stranici takmičenja, unutar discipline i kategorije, postoji faza **Ekipno** uz Kvalifikacije i Finale.
4. Miks tim prikazuje ime kluba (umesto samo SRB 1, SRB 2).
5. Ekipni nastup (klupski i miks) vidi se na profilu svakog strelca iz tima.
6. Ponovni uvoz (npr. kompletan bilten kasnije) dopunjava postojeće, bez duplikata.

## Šta nije cilj

- Računanje ekipnog plasmana iz pojedinačnih rezultata.
- Klupske rang liste; uticaj ekipnog nastupa na formu, lični peak i statistiku skorova.
- Ekipe iz Gemini (ne-SIUS) PDF-a, ISSF/SIUS sajta, live-fetch crona, Excel i ručnog unosa.
- Ručno menjanje ćelija ekipnog rezultata u pregledu.

**Anti-cilj:** plasman na sajtu koji se razlikuje od biltena, ili tiho preskočena ekipa.

## Pristupi

| Pristup | Dobro | Loše |
|---|---|---|
| **A. Nova tabela `team_results`** (izabran) | Tačno kao bilten, ne dira postojeće | Parser, migracija, pregled, prikaz |
| B. Računanje iz pojedinačnih | Najmanje posla | Pogrešno kod dve ekipe kluba, drugačijeg sastava, kazne. Odbačeno: plasman se uzima iz biltena |
| C. Proširenje `mixed_team_results` | Jedna tabela | Vezana za dva strelca i državu, dira ISSF/SIUS uvoz |

## Dizajn

### Podaci

`team_results`: `competition_id` (cascade), `competition_event_id` (null = glavni meč), `discipline_id`,
`category`, `team_name` (kako piše u biltenu), `rank`, `total`, `inners`, `remark`, `source`,
`created_at`.

`team_result_members`: `team_result_id` (cascade), redni broj, `shooter_id` (nullable), `name`, `series`,
`total`, `inners`, `remark`.

- Čuvaju se samo članovi ekipe. Strelac sa rezultatom u zagradi (naveden uz ekipu, ne ulazi u zbir)
  ne uvozi se u ekipni rezultat; njegov pojedinačni rezultat ostaje kao i svaki drugi.
- Jedinstven red: takmičenje + meč + disciplina + kategorija + naziv ekipe (`NULLS NOT DISTINCT`).
- Zasebna tabela članova (umesto JSON polja) da bi profil mogao da pretražuje po strelcu i da
  spajanje duplikata strelaca (`merge-shooters`) prebaci i ove veze.

### Povezivanje sa strelcem

Na `origin/main` miks već ima zaseban meč i vezu sa profilom po tačnom imenu i državi
(`2026-11-27-mixed-team-matches-design.md`), ali ne pravi nove strelce. Ovde se za **PDF uvoz** dodaje
pravljenje novih, uz proveru u pregledu; ostali izvori ostaju kakvi su. Isto pravilo za klupske ekipe i miks:

- Pri potvrdi uvoza član se vezuje za strelca po pojedinačnom rezultatu istog takmičenja (pojedinačni
  redovi se upisuju prvi), inače po sigurnom poklapanju imena u bazi. Nesiguran predlog se ne vezuje.
- Strelac koji ne postoji u bazi pravi se pri potvrdi, istim pravilima kao kod pojedinačnog uvoza:
  pregled ga navodi među novim strelcima, sa predlogom mogućeg duplikata koji admin potvrđuje ili
  odbija. Isti strelac iz više lista ili PDF-ova pravi se jednom.
- Podaci novog strelca: nacija kao kod pojedinačnog uvoza (pretpostavljena je označena), oružje iz
  discipline, klub po nazivu ekipe kad postoji u bazi. Pol: iz discipline za klupske ekipe; za miks
  po redosledu u timu (muški, pa ženski), admin ga u pregledu može ispraviti jer redosled u domaćem
  biltenu nije potvrđen.
- Postojeća veza se nikad ne briše praznom vrednošću.
- Dve ekipe istog naziva u istoj listi: druga po plasmanu dobija redni sufiks, da se ne prepišu.
- `mixed_team_results` dobija `club_name` (nullable). Upisuje se samo kad ga izvor ima (uvoz bez kluba
  ga ne briše) i ulazi u poređenje izmena, pa ponovni uvoz popunjava već uvezene timove.

### Parser

Primer formata postoji u `packages/adapters/src/pdf-import/__fixtures__/sss-kup-10m-nis-2026.pdf`
(SIUS fajl `Q…TA….ARM…`, podnaslov TEAM): red ekipe (mesto, naziv, zbirovi serija, ukupno), ispod nje
članovi sa startnim brojem. Pištolj: `1691-32x`. Zagrada: ne broji se. Postoji i DNS član; red ekipe
ume da bude prelomljen u dve linije.

- Čitaju se ekipne kvalifikacione liste pojedinačnih disciplina; strane iste liste se spajaju.
- Disciplina, kategorija, datum i meč određuju se istim pravilima kao za pojedinačne liste, da ekipa
  uvek padne u isti blok kao njeni strelci.
- Provera: zbir članova ekipe (bez onih u zagradi) = zbir ekipe. Strana koja ne prođe proveru ne uvozi se i
  prijavljuje se adminu kao upozorenje. Ne obara ostatak biltena.
- Miks: čuva se ime kluba; kategorija se čita istom funkcijom kao drugde (`parseCategory`), pa „U21”
  daje junior.

### Uvoz

- Rezultat parsiranja nosi i listu ekipa; pregled je prikazuje po disciplini i kategoriji sa opcijom
  „preskoči”. Pregled miksa prikazuje klub.
- Potvrda upisuje ekipe (upsert po jedinstvenom ključu) i broji nove / izmenjene / iste.
- Izbor „zaseban meč” važi i za ekipe iz tog PDF-a. Predloženi naziv i datum su isti koje bi dao
  kompletan bilten, da kasniji uvoz ne napravi duplikat.
- Brisanje rezultata discipline u adminu briše i njene ekipne rezultate.

### Prikaz

- Nova faza `team` (oznaka T, „Ekipno” / „Team”) u pregledu disciplina, u prekidaču faza i u URL-u
  (`stage=team`).
- Tabela: mesto (medalje za prva tri, iste kao u ostalim tabelama), ekipa, ukupno (i X).
- Klik na red ga širi: strelci jedan ispod drugog sa serijama i zbirom, povezani vode na profil.
- Blok discipline se pravi i kad postoji samo ekipni rezultat.
- Miks tabela prikazuje klub kad ga ima, inače državu kao danas.
- Profil strelca: ekipni nastup je red u istoriji, kao miks danas (ekipa, mesto, zbir ekipe), a
  proširen red prikazuje članove i njihove rezultate. Vodi na `stage=team` tog takmičenja.

### Provera

- Test parsera nad postojećim fixture-om (mesta, zbirovi, izostavljeni strelci u zagradi, DNS) i nad tvojim Smederevo PDF-ovima.
- Test da ponovljen uvoz istog PDF-a ne menja i ne duplira redove.
- Test povezivanja člana sa strelcem i prikaza ekipnog nastupa na profilu.
- Pregled stranice takmičenja lokalno, mobilni i desktop.

## Ograničenja

- Radi se na novoj grani od `origin/main`, pošto se tamo spoje trenutne izmene drugih sesija u istim
  fajlovima.
- Migracija ide kroz Drizzle (`db:generate`, `db:migrate`); primena na produkciju samo uz tvoju potvrdu.

## Nije još provereno

Smederevo PDF-ovi nisu viđeni. Pre izrade parsera treba potvrditi: oznake lista za U16/U18/U21, da li
su ekipe po kategorijama, broj članova i izgled ekipne i miks strane. Ako odstupaju, dizajn se dopunjava.

## Prepušteno graditelju

Raspored tabele, pretraga u ekipnoj fazi, nazivi komponenti i ruta.
