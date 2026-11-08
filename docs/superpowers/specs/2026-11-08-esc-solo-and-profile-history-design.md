# Faza 2: ESC Solo i nova istorija nastupa na profilu

Status: nacrt, čeka Aleksino odobrenje. Datum: 2026-11-08.
Povezano: `docs/discipline-catalog.md` (formati i nazivi), faza 1 (`65ea4f6`) i standard pištolj/300m (`6d75672`).

## Zašto

1. ESC Challenge (Solo, kasnije Trio/Duet) je novi format koji naši strelci gađaju na EP (npr. Aleksa: srebro u
   10m AR Solo na EP U23 Vroclav). Danas se ne može uvesti ni prikazati.
2. Profil strelca prikazuje samo pojedinačne rezultate iz `results`, u dve kolone (vazduh | MK). Mešoviti tim
   (`mixed_team_results`) se uopšte ne vidi, a treća disciplina na istom takmičenju se gura u drugu kolonu.
   Kodovi (ARM, R3PW) korisnicima ne znače ništa.

## Ciljevi

- ESC Solo (10m AR i AP, M i Ž) kao posebne discipline: uvoz sa SIUS-a, prikaz na stranici takmičenja i profilu.
- Istorija nastupa na profilu: jedan red po disciplini, puni nazivi (sr/en), mešoviti tim uključen, radi isto na
  telefonu i desktopu.
- Jedan izvor naziva disciplina za profil i stranicu takmičenja.

## Ne-ciljevi

- ESC Trio i Duet (faza 3).
- ESC u formi, rangiranju ili rekordima. Forma je samo za olimpijske pojedinačne discipline (ARM, ARW, APM, APW,
  R3PM, R3PW, SPW, RFPM) — već urađeno u `FORMA_DISCIPLINE_CODES` (`apps/web/src/lib/forma.ts`).
- PDF/Gemini, Excel i ručni unos za Solo. ESC rezultati postoje samo na SIUS cloud-u.
- Live-fetch (ticker) za Solo.
- Prebacivanje svih ostalih mapa naziva (GlobalSearch, naslovna, vesti, CMS embed, admin) na novi izvor — kasnije.
- Rang lista po disciplini za nove discipline.

## Anti-ciljevi (neuspeh čak i ako radi)

- Solo pogoci (52) pomešani sa ISSF skorom (628.4) tako da izgleda kao isti format.
- Solo ili mešoviti tim utiče na formu ili rangiranje.
- Na telefonu nazivi disciplina u tri reda ili horizontalni skrol.
- Pol u nazivu discipline na profilu (profil je jedne osobe).

## Šta je odlučeno (Aleksa)

- Solo je posebna disciplina, ne ulazi u formu.
- Nazivi (tabela u `docs/discipline-catalog.md`, odeljak "Nazivi u aplikaciji"): npr. "10m vazdušna puška ESC Solo" /
  "10m Air Rifle ESC Solo"; mešoviti tim "10m vazdušna puška miks" / "10m Air Rifle Mixed Team"; bez "MK" i
  "trostav"; R3P po varijanti "50m puška 3x40" / "3x20"; bez pola na profilu.
- Profil: jedan red = jedna disciplina, bez kolona po oružju, bez naslova grupa; stalni redosled unutar
  takmičenja: pojedinačno → mešoviti tim → ESC.

## ESC Solo format (iz SIUS-a, potvrđeno na EP U23 Vroclav 2026)

SIUS event: `EventCode` npr. `ARM-ECH-SOLO`, naziv "10m AIR RIFLE SOLO MEN". Subeventi:

| Subevent | Šta je | Rezultat (`Result.Value`) | Serije | Oznaka prolaska |
|---|---|---|---|---|
| Qualification Part 1 | 30 hitaca, pogodak ≥10.3 (AR) / ≥9.8 (AP) | pogoci od 30 | 3 × broj pogodaka u 10 hitaca | `Q` (top 16) |
| Qualification Part 2 | još 30 hitaca, zbir se prenosi | pogoci od 60 (kumulativno) | 6 | `QG` (1–2), `QB` (3–4) |
| Bronze Medal Match | 3. vs 4. | pogoci | 5 × pogoci u 3 hica | — |
| Gold Medal Match | 1. vs 2. | pogoci | 5 × pogoci u 3 hica | — |

`NumberOfInnerTen` sadrži besmislene vrednosti za Solo → ignorisati. Nema decimalnih hitaca.

## Kako (odluke)

### Kodovi

Četiri nove vrednosti u `discipline_code` enumu: **`SOLOARM`, `SOLOARW`, `SOLOAPM`, `SOLOAPW`**.
(Moja odluka. Katalog je predlagao `ESC_AR_SOLO_M`; kod ne sme da počinje sa `AR`/`AP`, jer bi ga postojeći
`startsWith("AR")` uslovi tretirali kao vazdušnu pušku sa decimalama. Katalog se ažurira.)
Helper `isEscSoloCode(code)` u `packages/db/src/pdf-import-types.ts`.

Seed: `disciplines` red (distance 10, apparatus air_rifle/air_pistol, gender M/F, maxQualScore 60) i jedna
varijanta po kodu (`soloarm-esc` …, hasDecimals false, bez finalDisplayType).

### Skladištenje: jedan red u `results` po strelcu

K1 i K2 su jedna kvalifikacija od 60 hitaca (K2 se nadovezuje na K1), pa obe idu u kolone kvalifikacije.
Kolone eliminacije (`elim*`) ostaju **prazne** za Solo: njih čita 16 fajlova kao trostav eliminaciju (oznaka "E",
link na fazu eliminacije, ticker), pa bi ih Solo pogrešno aktivirao. (Odluka posle Aleksinog pitanja.)

| Solo faza | Kolone | Napomena |
|---|---|---|
| Kvalifikacija (K1 + K2) | `qualTotal` = konačni kval rezultat: pogoci /60 za one koji su gađali K2, pogoci /30 za ostale; `qualRank` = K2 rang za učesnike K2, inače K1 rang iz SIUS-a; `qualified` = ušao u meč | ko prolazi odlučuje SIUS, ne aplikacija (vidi ispod) |
| | `qualDetail = { format: "esc_solo", part1: { series:[3], total, rank, remark }, part2?: { series:[6], total, rank, remark } }` | novi član `QualDetail` unije |
| Meč za medalju | `finalTotal` (pogoci), `finalRank` (1–4), `finalDetail = { format:"bulletin", scoring:"hit_count", series:[…5], opponentTotal, opponentName }` | samo top 4 |

`opponentTotal` i `opponentName` su dva nova opciona polja u `BulletinFinalDetail`. `finalRank` se uzima iz
SIUS ranga meča (GMM: 1/2, BMM: 3/4).

Prolaz ne računa aplikacija: K2 učesnik je svako ko se pojavi u SIUS rezultatima K2, a u meč ide ko se pojavi
u GMM/BMM. Na Vroclavu je K2 gađalo 18 (izjednačeni na 16. mestu), pa "top 16" nigde nije zakucano u kodu.

Konačni plasman (za prikaz): `finalRank` ako postoji, inače `qualRank`. Helper `escSoloPlacement(row)`.
Svi čitači `qualDetail` koji ne znaju `format: "esc_solo"` moraju da ga preskoče (provera `"series" in detail`
već postoji u `ResultDetailPanel`; graditelj proverava ostale).

Nerešen meč (npr. 12 : 12, pa pojedinačni hici): `finalRank` se uzima iz SIUS `Rank`, ne iz poređenja zbirova.
Shoot-off se ne čuva kao hici; ako SIUS da oznaku (SO / shoot-off) ide u `remarkDetails.final.shootOff` i
prikazuje se kao "12 : 12 SO". (moja odluka)

Kategorija: ista pravila kao za pojedinačne SIUS evente (`splitEventCode`: sufiks J → junior, U16/U18 → kadet /
mlađi junior, inače senior). Solo na EP U23 dobija istu kategoriju kao ARM na istom takmičenju; ništa posebno
za Solo. (moja odluka)

### Gde se Solo NE pojavljuje

Solo je u `results`, pa ga moraju isključiti svi čitači koji porede skorove (pogoci nisu uporedivi sa ISSF
skorom): H2H (`api/h2h/route.ts`), profil quick stats peak (`strelci/[id]/page.tsx`), lista strelaca
(`strelci/page.tsx`), naslovna top-3 i ticker (`homepage-data.ts`), forma (već). Jedan zajednički filter
`notEscSolo` (ili `inArray` sa ne-Solo kodovima) na tim upitima. Profil quick stats: "nastupa" broji
takmičenja uključujući mešoviti tim i Solo; "finala" broji samo pojedinačna ISSF finala; peak samo forma
discipline. (moja odluka)

### Uvoz (SIUS)

`packages/adapters/src/sius/public-adapter.ts`: nova funkcija `fetchSiusEscSoloResults(competitionId, eventId)`.
Prepoznaje subevente po nazivu: `/qualification part 1/i`, `/qualification part 2/i`, `/gold medal match/i`,
`/bronze medal match/i`; vraća po strelcu spojene faze. Mapiranje EventCode → kod: `^(AR|AP)([MW])-ECH-SOLO$` →
`SOLO$1$2`. Juniorske varijante (sufiks J ili `-JR`) → kategorija junior ako se pojave; ako ne postoje u podacima,
ne nagađati.

Admin: u postojećem SIUS modu (`SiusMode.tsx` → `api/admin/sius/public-import` → `buildSiusImport`) Solo eventi
se prikazuju u listi i idu kroz isti review + commit tok (`import-commit.ts`), sa novim kolonama u review tabeli
samo za Solo (K1, K2, meč). `recomputeFormaCache` se poziva kao i inače i ne dira Solo (filtrira ga
`FORMA_DISCIPLINE_CODES`).

### Stranica takmičenja

`CompetitionResultsClient` dobija Solo discipline u redosledu posle mešovitih timova i porodicu po oružju.
Prikaz Solo-a: tri tabele jedna ispod druge — Mečevi za medalju (zlato, bronza: dva strelca i rezultat X : Y),
Kvalifikacija 2 (rang, ime, serije, ukupno, QG/QB), Kvalifikacija 1 (rang, ime, 3 serije, ukupno, Q).
Iznad tabela jedna rečenica: "Pogoci: 10.3 i više (puška) / 9.8 i više (pištolj)". Sve celi brojevi.

### Profil: nova istorija nastupa

Podaci (`strelci/[id]/page.tsx` i `lib/shooter-results.ts` za arhivu `/rezultati`):
- `results` kao danas + `mixed_team_results` gde je `shooter1Id` ili `shooter2Id` = strelac; partner = drugi
  strelac (ime iz `shooters` ako je povezan, inače `shooterXName`).
- Zajednički red-tip `HistoryRow` sa `kind: "individual" | "mixed" | "esc"`.

`ResultsHistoryTable` (prepisuje se grid deo, zadržava se: grupisanje po takmičenju, zaglavlje takmičenja,
filter po disciplini, accordion detalja sa `ResultDetailPanel`):
- Unutar takmičenja redovi sortirani: individual (po `DISCIPLINE_ORDER`) → mixed → esc.
- **Desktop (≥640px)**: jedan red sa 4 kolone — naziv discipline | dodatak | kvalifikacija `#rang` | finale/meč.
- **Telefon**: isti red u dve linije — gore naziv levo, kvalifikacija desno; dole (sitno) dodatak levo,
  finale/meč desno.
- Dodatak: individual → kategorija ako nije senior (npr. "Junior"); mixed → "sa I. Prezime"; esc → "ESC Challenge".
- Solo red: kvalifikacija = K2 pogoci ako postoji, inače K1 (`52 pog. #1`); desno = medalja + "meč 10 : 12" ili
  konačni plasman.
- Mixed red: `qualTotal #qualRank`, desno finale/medalja kao individual; klik otvara serije oba člana
  (`shooter1Detail`/`shooter2Detail`).
- Filter po disciplini koristi pune nazive.
- Medalje (`MEDAL_COLOR`) i formatiranje decimala ostaju kao danas (`qualHasDecimals`).

### Nazivi disciplina — jedan izvor

Novi modul `packages/db/src/discipline-names.ts`:
`disciplineName(code, locale, { gender?: boolean; variant?: "3x20" | "3x40" })`.
Pun naziv po tabeli iz kataloga i na telefonu — bez skraćenica (moja odluka: najduži naziv,
"10m vazdušni pištolj ESC Solo", staje u ~220px gornje linije reda; ako ne stane, prelama se u drugu liniju
naziva, nikad u treću). `gender` dodaje "seniori/seniorke" / "Men/Women" (za rang liste, kasnije). Profil i stranica takmičenja ga koriste; ostale mape
ostaju dok se ne pređe na njih (ne-cilj).

## Ograničenja

- Bez novih kolona u `results`; jedina migracija je enum (4 vrednosti), `ADD VALUE IF NOT EXISTS`.
- `pnpm` skripte iz package.json, ne sirovi npx.
- Testovi: postojeći moraju proći; novi za mapiranje SIUS Solo faza (fixture: sirovi `/subevents` i `/series`
  JSON za ARM-ECH-SOLO sa EP U23 Vroclav, preuzet sa javnog SIUS API-ja i sačuvan u adapters testovima),
  `escSoloPlacement`, `disciplineName`, i sortiranje redova u istoriji.
- Profil ostaje SSR; nema novog klijentskog fetch-a.

## Ostavljeno graditelju

- Kako se Solo eventi prikazuju u admin SIUS listi (zasebna grupa ili isti spisak).

- Tačan izgled Solo tabela na stranici takmičenja unutar postojećeg vizuelnog jezika (`CompetitionQualTable`).
- Da li se mixed detalj prikazuje kroz postojeći `ResultDetailPanel` ili mali novi panel.
- Imenovanje internih tipova i fajlova.
