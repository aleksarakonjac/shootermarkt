# Forma v2 — specifikacija (grilling, 2026-10-21)

Zamenjuje model opisan u [forma-score.md](forma-score.md) (v1: prognoza = level + trend·stepDays
sa ceiling kompresijom). Kad v2 bude implementiran, `forma-score.md` se ažurira prema ovom dokumentu.

## Zašto

- Nemoguće vrednosti: SPW 603.6, R3PW 608.3, ranije 651 / 684.8 (R3PM). Uzrok: projekcija trenda bez
  plafona za R3P/SPW + 747 lažnih nula iz SIUS importa (popravljeno, vidi dole).
- Agresivna projekcija sa 2–4 nastupa (564 → 580 daje formu 585.5).
- Težine kategorije su mrtve: svih 6675 rezultata ima `category = senior`.
- Nivo `world` meša SP, SK, Finale SK, Grand Prix, juniorska SP/SK.

## Odluke

| # | Tema | Odluka |
|---|---|---|
| 1 | Značenje | ~~Hibrid~~ → **forma = težinski nivo**, trend samo kao strelica (izmenjeno posle backtesta, vidi ispod). |
| 2 | Iznad peak-a | Bez trenda nepotrebno (prosek ≤ peak). Prvobitno: | Forma ≤ lični peak **+1.0 (AR)** / **+2 (AP, SP, R3P)**. Primenjuje se poslednje. |
| 3 | Uticaj trenda | Važi samo za **strelicu**. Težina trenda po broju nastupa n: 1–3 → 0, 4 → 0.25, 5 → 0.5, 6 → 0.75, ≥7 → 1.0. Doprinos trenda ograničen na **±1.5 (AR)** / **±3 (ostalo)**. |
| 4 | Outlieri | Nastup mnogo ispod tipičnog nivoa (> 3× robusno rasipanje, MAD oko medijane) dobija manju težinu. **Samo naniže**; dobri nastupi se ne prigušuju. |
| 5 | Neaktivnost | Forma se ne menja sa pauzom. Rang lista traži nastup u poslednjih **365 dana**. Profil prikazuje "poslednji nastup pre X meseci" kad je pauza > ~6 meseci. |
| 6 | Plafon | Bez trenda nepotrebno (prosek ≤ max). Prvobitno: asimptotska kompresija **samo uzlaznog trenda**: `gain' = headroom·(1 − e^(−gain/headroom))`, `headroom = plafon − nivo`. Plafoni: R3PM/R3PW/SPW/APM/APW **600**, ARM/ARW **640**. Nivo se ne kompresuje. |
| 7 | Time-decay | Poluvreme **180 dana** (backtest bolji od 120), max starost **365 dana**. |
| 8 | Težine nivoa | Zadržavaju se, ali iz para (`level`, `event_type`) — vidi tabelu ispod. |
| 9 | Tagovanje | `event_type` auto-popuniti po nazivu za postojeća takmičenja i u svim importima; ostatak ručno. |
| 10 | Kategorija | `results.category` = **kategorija meča** u kom je rezultat ispucan (ne uzrast strelca). Importi je čitaju iz naslova meča (SSC i SIUS danas zakucavaju `senior`). `competitions.age_category` i `competitions.forma_weight` se brišu (mrtve kolone). |
| 11 | Duplikati | Isti skor, isto takmičenje, ista disciplina, različite kategorije = isti meč → forma ga broji **jednom**, sa najjačom kategorijom. Redovi u bazi ostaju (junior liste). |
| 12 | Nevažeći | Forma ignoriše skor ≤ 0 i rezultate sa `qual_remark` **DNF / DNS / DSQ**. |
| 13 | Grafik | Jedan grafik: **tačke** = stvarni rezultati, **linija** = rolling forma, pojas ± pouzdanosti. Bez prekidača. X osa po redosledu nastupa. |
| 14 | Validacija | **Backtest** (forma iz prethodnih nastupa vs stvarni sledeći rezultat, MAE po disciplini, stari vs novi model, provera plafona) kao `pnpm` skripta + ručni pregled poznatih strelaca. |
| 15 | Faze | Vidi ispod. Svaki novi faktor ulazi samo ako backtest pokaže manju grešku. |

### Težine nivoa (odluka 8)

| level + event_type | težina |
|---|---|
| olympic | 1.00 |
| world + championship | 0.95 |
| world + world_cup (uklj. Finale SK) | 0.90 |
| continental + championship | 0.85 |
| world + grand_prix | 0.80 |
| continental + ostalo | 0.72 |
| international | 0.68 |
| national | 0.68 |
| regional | 0.50 |
| club | 0.38 |

Težine kategorije (pionir 0.55 … senior/open 1.0) ostaju kao u v1.

### Ostale metrike

`reliability`, `consistency`, `trend`, `momentum`, `peak`, `peakProximity`, `sampleSize` ostaju
zasebne metrike i ne ulaze u forma broj (kao u v1). Rangiranje: forma DESC, ≥5 nastupa, aktivan
u 365 dana, tiebreak peak → sampleSize.

## Backtest (2026-10-21) — zašto je trend izbačen

Prognoze sa ≥ 5 ranijih nastupa (n = 910), MAE u poenima:

| model | MAE |
|---|---|
| v1 | 3.81 |
| prosek poslednjih 5 | 2.96 |
| v2 sa trendom (hibrid, poluvreme 120) | 3.16 |
| v2 bez trenda, poluvreme 180 | **2.94** |

Svaka probana varijanta trenda (start od 6/14 nastupa, slabiji ramp, druga poluvremena) bila je lošija
od varijante bez trenda. Težine nivoa takmičenja trenutno nemaju efekat jer `event_type` nije tagovan.

## Admin: bulk izmena takmičenja

Jedna lista takmičenja sa inline izmenom **level**, **event_type** i **tagova**, i jednim Save na dnu
(bez ulaska u edit stranu svakog takmičenja). Kategorija se menja po paru **takmičenje × meč
(disciplina + kategorija)**, ne po takmičenju — jedno takmičenje može imati više kategorija.

## Faze

1. **Osnovni v2 model** (odluke 1–14) + backtest skripta + grafik B + bulk admin lista + auto-tag.
2. **Težina takmičenja/strelišta**: zajednički offset po meču (koliko su svi strelci odstupili od
   svog nivoa), rezultat se koriguje pre ulaska u formu. Najveći očekivani efekat kod R3P/SPW.
3. **Razvojna kriva po uzrastu** (juniori) i **"rđa" posle pauze** > 3 meseca — svaki zasebno kroz backtest.
4. Kasnije, ako backtest opravda: domaći teren, period sezone, smena/vreme dana.

**Ne radimo:** lične obrasce po lokaciji / vremenu / sezoni dok strelac nema 30+ nastupa (overfitting).

## Već urađeno (2026-10-21)

- 747 `qual_total = 0` iz SIUS importa: uzrok je stariji SIUS format bez `TotalScore`
  (`public-adapter.ts` sada čita `Result` string). Ponovo uvezena takmičenja 126, 139, 140, 141.
  Preostala jedna nula (DNF) → `NULL`. Preostalih 200 `NULL`-ova su DNS/DSQ ili samo finale/eliminacija.
- `computeForma` i `getFormaEntriesByDiscipline` ignorišu skor ≤ 0; SSC adapter `?? null`.
