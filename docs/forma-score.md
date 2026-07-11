# Forma Score — kompletna dokumentacija

> Jedinstveni izvor istine: [`src/lib/forma.ts`](../src/lib/forma.ts)
> Svi delovi aplikacije (profil, lista strelaca, rangiranje, homepage, h2h, CMS) koriste ovaj jedan modul.

---

## 1. Šta je Forma Score

**Forma score NIJE prosek prošlih rezultata.**

Forma score je **prognoza sledećeg nastupa** — najbolja procena koliko će strelac
pucati na svom narednom takmičenju, izražena na skali stvarnog rezultata
(npr. `624.3` za vazdušnu pušku, `577` za vazdušni pištolj).

Ta razlika je ključna:

| Pristup | Šta odgovara |
|---|---|
| Prosek prošlih rezultata | "Koliko je strelac pucao u proseku" (unazad) |
| **Forma score (naš)** | "Koliko očekujemo da će pucati sledeći put" (unapred) |

Zato forma ima **pogled u budućnost**: strelac u usponu dobija formu *iznad*
poslednjeg rezultata, jer sistem projektuje trend napred. Strelac u padu dobija
formu *ispod* poslednjeg. Stabilan strelac ima formu ≈ trenutni nivo.

### Zašto na skali rezultata (a ne 0–100)

Broj `624.3` nosi konkretno značenje strelcu i treneru — zna šta to znači na liniji.
Prognoza "očekujemo ~624 sledeći put" je opipljiva informacija. Skaliranje na 0–100
bi to obrisalo. Cena: forma iz puške i pištolja se ne mogu direktno porediti (različite
skale) — ali to poređenje ionako nije smisleno (različite discipline, psihologije).

---

## 2. Filozofija: broj je čist, stabilnost je odvojena

Ranija verzija je ubacivala "consistency bonus" u sam forma broj (stabilan strelac
dobija +X poena). To je bila greška: ako forma treba da predviđa opipljiv rezultat,
naduvavanje broja zbog stabilnosti kvari predviđanje. Strelac koji stabilno puca 620
nema razloga da mu prikažemo 622.

**Nova logika:**

- **Forma broj = čista prognoza.** Ništa se ne dodaje "za nagradu".
- **Stabilnost = zasebne metrike** (`reliability`, `consistency`). One ti govore
  KOLIKO da veruješ prognozi, ne menjaju je.

Analogija: Transfermarkt tržišna vrednost je jedan broj. Kompleksnost nije u guranju
svega u taj broj, nego u zasebnim metrikama (forma, minutaža, trend) oko njega.

---

## 3. Algoritam korak po korak

Model je **weighted linear regression** (težinski linearni trend) preko poslednjih
nastupa, projektovan jedan tipičan razmak unapred, sa kompresijom blizu plafona discipline.

### 3.0 Ulaz

```ts
type FormaEntry = {
  score: number;                    // qualTotal
  date: string;                     // ISO YYYY-MM-DD
  level?: CompetitionLevel | null;  // nivo takmičenja (opciono)
};
```

Ulaz može biti u bilo kom redosledu — sortira se interno po datumu.

**Efektivni prozor.** Pre nego što se uzme poslednjih `WINDOW = 20` nastupa, odbacuju se
svi stariji od `MAX_AGE_DAYS` (= `2 × DECAY_HALFLIFE` = **300 dana**). Razlog: nastup star
900 dana ima decay-težinu ~0.015 (praktično nula), ali bi i dalje ušao u bucket
kalkulaciju — potencijalno kao jedini član "stare" polovine i izvor lažnog trenda.
Efektivni prozor kontroliše decay + `MAX_AGE_DAYS`, ne broj nastupa — `WINDOW` je samo
gornja granica (dovoljno visoka da aktivni strelci koriste sve skorašnje nastupe; decay
prigušuje stare pa dodatne tačke samo stabilizuju procenu). Nakon filtera `slice(-WINDOW)`.
Dan poslednjeg nastupa uvek prolazi filter, pa prozor nikad nije prazan ako ima ijedan nastup.

### 3.1 Težina svakog nastupa

Svaki nastup dobija težinu koja spaja dva signala:

```
w_i = time_decay(datum_i) × level_weight(nivo_i)
```

**a) Time-decay** — noviji nastupi vrede više, po STVARNOM datumu:

```
time_decay(datum) = exp( (datum − asOf) / τ )
```

- `asOf` = datum poslednjeg nastupa (referentna tačka, `t = 0`)
- `t_i` = broj dana pre `asOf` (uvek ≤ 0)
- `τ = 150 / ln(2) ≈ 216` — poluvreme **150 dana**: nastup star 150 dana vredi upola

Ovo rešava problem povratka posle pauze: rezultati od pre godinu dana skoro ne utiču.

**b) Level-weight** — jače takmičenje = pouzdaniji signal:

| Nivo | Težina |
|---|---|
| `olympic` | 1.00 |
| `world` (ISSF svetsko) | 0.92 |
| `continental` | 0.82 |
| `international` | 0.68 |
| `national` (državno) | 0.68 |
| `regional` | 0.50 |
| `club` (klubsko) | 0.38 |
| nepoznato / bez nivoa | 0.60 |

`international` i `national` su **namerno izjednačeni** — jako državno prvenstvo u nekoj
zemlji može biti teže od slabog međunarodnog turnira, pa ih ne rangiramo jedno iznad
drugog.

> **Bitno:** level-weight deluje samo kad strelac **meša** nivoe. Ako su svi nastupi
> istog nivoa, relativne težine se poništavaju (regresija je invarijantna na množenje
> svih težina istom konstantom) — što je matematički ispravno. Efekat se vidi kad,
> npr. klupski rezultat 628 i svetski 620 konkurišu: svetski nosi jači signal.

### 3.2 Nivo (level) — gde strelac trenutno puca

Iz težina računamo težinske proseke:

```
W       = Σ w_i
meanT   = Σ w_i · t_i / W          (težinski centar vremena)
meanY   = Σ w_i · y_i / W          (težinski prosek rezultata)
```

Nivo se dobija projekcijom trend-linije na `t = 0` (dan poslednjeg nastupa):

```
level = meanY − b · meanT
```

gde je `b` nagib (sledeći korak).

> **Napomena:** `level` je ankorisanje trenda na dan poslednjeg nastupa (`asOf`),
> ne na danas. Ako je strelac nastupao pre 2 meseca, `level` opisuje tada procenjeni
> nivo. `forma` (= `level + gain`) je prognoza sledećeg nastupa i jedini broj koji se
> prikazuje korisniku kao "forma".

### 3.3 Nagib (trend) — robusni bucket-ovi

Naivna regresija ovde ima **leverage problem**: daleka tačka (npr. rezultat od pre
400 dana) dominira nagib preko `t²`, jer je leverage proporcionalan kvadratu vremena.
Time-decay to ne poništava dovoljno.

Zato nagib računamo iz **dve grupe** umesto sirove regresije:

1. Podeli nastupe na **noviju** (`t_i ≥ meanT`) i **stariju** (`t_i < meanT`) polovinu
2. Izračunaj težinski prosek rezultata i vremena u svakoj grupi:
   `yNew, tNew` i `yOld, tOld`
3. Nagib:
   ```
   rawB = (yNew − yOld) / (tNew − tOld)     [poena po danu]
   ```
4. **Shrink po pouzdanosti** — ne veruj trendu koji drži zanemarljiva težina:
   ```
   confidence = 2 · min(W_new, W_old) / (W_new + W_old)     ∈ [0, 1]
   b = rawB × confidence
   ```
   Kad je jedna grupa jaka a druga skoro prazna (npr. usamljen stari nastup),
   `confidence → 0` pa nagib nestaje. Balansirane grupe → `confidence → 1`.

Ovo rešava lažni trend: strelac koji se vratio na nižem nivou (staro 625, skorašnje
610–611) ne dobija spurious "pad" projekciju — vidi se samo kao promena nivoa.

### 3.4 Projekcija unapred

Trend se projektuje jedan **tipičan razmak** unapred:

```
stepDays = clamp( median(razmaci između nastupa), 14, 60 )   [dana]
gain     = b · stepDays
forma    = level + gain
```

`stepDays` je medijana razmaka (robusna na povratak-gap), ograničena na 14–60 dana
(jedan meč je tipično nedelje, ne meseci).

**Smer trenda (↑ ↓ →) sa dinamičkim pragom.** Fiksan prag bi nestabilnom strelcu
davao trend na osnovu šuma. Zato je prag skaliran sa `reliability`:

```
dynamicEps = max( TREND_EPS, reliability · 0.25 )
trend = gain > dynamicEps ? ↑ : gain < −dynamicEps ? ↓ : →
```

Da bi bio trend, `gain` mora preći bar 25% tipičnog šuma strelca. Za stabilnog
(reliability ≈ 2) → prag ≈ 0.5 (skoro kao ranije). Za nestabilnog (reliability ≈ 8) →
prag = 2.0, tek jasan i konzistentan pomak proglašava trend. `TREND_EPS` je donja granica.

### 3.5 Ceiling kompresija

Rast blizu fizičkog maksimuma discipline je teži — ne možeš linearno ekstrapolirati
strelca ka nemogućim rezultatima. Zato se **samo uzlazni** `gain` priguši ka plafonu:

```
ako gain > 0 i postoji realisticMax:
    headroom = max(0, realisticMax − level)
    gain     = headroom · (1 − exp(−gain / headroom))
```

Meko asimptotsko zasićenje: `gain` nikad ne probije `headroom`, pa `forma` nikad ne
pređe `realisticMax`. Silazni `gain` se NE dira.

**Realni maksimumi** (`REALISTIC_MAX`, kvalifikacije) — blizu svetskog rekorda, NE
teorijski max:

| Disciplina | Realni max | Napomena |
|---|---|---|
| ARM / ARW | **637.9** | Svetski rekord (M i Ž). Teorijski 654.0 je praktično nedostižan — ni puška u stegi ne opali toliko. |
| APM | **594** | Muški WR kvalifikacije (teorijski 600) |
| APW | **591** | Ženski WR kvalifikacije (teorijski 600) |

> Za elitne strelce (633+) kompresija se oseti; za prosečne (npr. 615) `headroom` je
> velik pa efekat zanemarljiv — tačno kako treba.

### 3.6 Rezime formule

```
w_i    = exp((t_i)/τ) · level_weight(level_i)
level  = Σw·y/Σw − b · (Σw·t/Σw)
b      = bucket_slope × confidence
forma  = level + ceiling_compress( b · stepDays )
```

---

## 4. Izlazne metrike

`computeForma()` vraća `FormaResult`:

| Polje | Značenje | Kako se koristi |
|---|---|---|
| `forma` | Prognozirani sledeći rezultat | Glavni broj svuda |
| `level` | Trenutni nivo bez projekcije | Metric strip na profilu |
| `reliability` | ± raspon prognoze (težinski std oko trenda) | `±3.2` uz forma broj |
| `trend` | `up` / `down` / `stable` | Strelica ↑ ↓ → |
| `momentum` | Ubrzava li se poboljšanje (novija vs starija polovina nagiba) | "ubrzava/usporava" |
| `peak` | Najbolji rezultat ikad | Profil, quick stats |
| `peakProximity` | `forma / peak`, clamp na **1.05** | Bar "94% peak-a" |
| `consistency` | 0–1 skor stabilnosti | Label Stabilan/Promenljiv + dots |
| `sampleSize` | Broj nastupa u obračunu | Kvalifikacija za rang, "10 nastupa" |
| `lowConfidence` | `sampleSize < 5` → procena nepouzdana | Sivi broj + badge "malo podataka", `±?` |

### Momentum

Momentum = **WLS nagib unutar novije polovine** minus **WLS nagib unutar starije
polovine**. "Novija/starija polovina" su isti bucket-ovi kao u sekciji 3.3; unutar
svake polovine računa se pun weighted least squares nagib (ne bucket-of-bucket, nema
rekurzije). Pozitivan momentum uz `trend = up` znači da se **ubrzava**; negativan uz
`trend = up` znači da **usporava**. Prikazuje se samo kad `|momentum| > 0.15 poena/dan`
i uz aktivan trend (ne uz `stable`).

### peakProximity

Clampovan na **1.05**. Vrednost `> 1.0` znači da forma projektuje **novi lični rekord**
(strelac je bolji nego ikad) — UI to prikazuje posebno (npr. zlatna boja, "novi rekord
se očekuje"), a clamp na 1.05 sprečava da progress bar pukne.

### lowConfidence

`true` kad `sampleSize < RANKING_MIN_SAMPLE` (5). Broj se i dalje prikazuje, ali:
sivom bojom (ne primarnom), uz badge "malo podataka" i tooltip
"Procena nepouzdana — manje od 5 nastupa"; `reliability` se prikazuje kao `±?`.
Broj se NE sakriva — samo se komunicira nesigurnost.

### Pouzdanost i konzistentnost

```
reliability = sqrt( Σ w_i · (y_i − linija_i)² / W )     [težinski std reziduala]
consistency = clamp( 1 − reliability / consistencyRange, 0, 1 )
```

`consistencyRange` je podrazumevano `CONSISTENCY_RANGE = 15`, ali se može proslediti
per-disciplina kroz `opts.consistencyRange` (prihvatljiv scatter razlikuje se: 10m
vazd. ≠ 50m ležeći). Vidi sekciju 6.

`consistency` label:
- `≥ 0.75` → **Stabilan**
- `0.5 – 0.75` → **Promenljiv**
- `< 0.5` → **Nestabilan**

---

## 5. Rangiranje strelaca

Leaderboard (`rangiranje/page.tsx`, homepage top-forma, club leaderboard):

1. **Primarni ključ = `forma`** (prognoza), sort opadajuće.
   Leaderboard postaje "koga predviđamo da će pucati najviše sledeći put" — jača i
   zanimljivija tvrdnja od "ko je prosečno najviši".

2. **Kvalifikacija: `sampleSize ≥ 5`** (`RANKING_MIN_SAMPLE`).
   Prognoza sa malim uzorkom je nepouzdana. Strelac sa 2 nastupa i forma 625 (šum)
   ne sme da preskoči strelca sa 15 nastupa i stabilnih 623. Ispod praga →
   "nedovoljno podataka", ne rangira se sa punopravnima.

3. **Tiebreak:** `peak` → `sampleSize`.

4. **Konzistentnost/reliability = zasebne kolone**, nikad u forma broju.

Prag rešava mali-uzorak zamku bez prljanja broja. Uz to, `lowConfidence` flag
(`sampleSize < 5`) i dinamički trend prag (skaliran sa reliability) već ublažavaju
nepouzdane procene na prikazu — pa složeniji Bayesian shrinkage nije potreban za
trenutnu fazu.

---

## 6. Rolling forma (grafik)

`rollingForma(entries)` vraća formu **na svakom nastupu** — kako je izgledala tada:

```ts
rollingForma(chrono) = chrono.map((_, i) => computeForma(chrono.slice(0, i+1)).forma)
```

Tako grafik na profilu prikazuje evoluciju forme kroz vreme, a ne sirove rezultate.
Glavni broj u headeru grafika = poslednja tačka linije = trenutna forma.

---

## 7. API

```ts
// Glavna funkcija
computeForma(
  entries: FormaEntry[],
  opts?: { code?: string; realisticMax?: number; consistencyRange?: number }
): FormaResult

// Forma na svakom nastupu (za grafik)
rollingForma(entries: FormaEntry[], opts?): number[]

// Kompat: iz {qualTotal, date, level}[]
computeFormaFromEntries(entries, opts?): FormaResult

// Pomoćne
trendLabel(trend): "↑" | "↓" | "→"
trendColor(trend): string   // CSS var
RANKING_MIN_SAMPLE = 5
REALISTIC_MAX = { ARM: 637.9, ARW: 637.9, APM: 594, APW: 591 }
```

`opts.code` uključuje ceiling kompresiju (traži `REALISTIC_MAX[code]`).
`opts.realisticMax` pretiče mapu. `opts.consistencyRange` pretiče `CONSISTENCY_RANGE`
za normalizaciju konzistentnosti (vidi sekciju 8).

---

## 8. Parametri (za tjuning)

| Konstanta | Vrednost | Uloga |
|---|---|---|
| `WINDOW` | 20 | Gornja granica broja nastupa (stvarni limit = decay + MAX_AGE) |
| `DECAY_HALFLIFE` | 150 dana | Poluvreme time-decay-a |
| `MAX_AGE_DAYS` | 300 dana (`2×DECAY_HALFLIFE`) | Nastupi stariji od ovoga se odbacuju pre WINDOW slice-a |
| `STEP_MIN / STEP_MAX` | 14 / 60 dana | Granice projekcije unapred |
| `TREND_EPS` | 0.4 poena | Donja granica praga za ↑ / ↓ |
| `CONSISTENCY_RANGE` | 15 | Podrazumevana normalizacija consistency (override kroz `opts`) |
| `LEVEL_WEIGHT_DEFAULT` | 0.60 | Težina kad nivo nepoznat |
| `RANKING_MIN_SAMPLE` | 5 | Min nastupa za rang; ispod → `lowConfidence` |

**Dinamički trend prag.** Efektivni prag za ↑ / ↓ nije fiksan `TREND_EPS`, nego
`max(TREND_EPS, reliability × 0.25)` — nestabilan strelac zahteva veći pomak da bi
dobio trend (vidi sekciju 3.4).

**`consistencyRange` per-disciplina** (prosleđuje se kroz `opts.consistencyRange`;
vrednosti se definišu van `forma.ts`, npr. u `lib/disciplines.ts`):

| Disciplina | Preporučeni `consistencyRange` |
|---|---|
| ARM / ARW | 12 |
| APM / APW | 15 |
| 50m rifle | 18 |
| 25m pistol | 20 |

Ako se ne prosledi, ostaje 15 (nema breaking change).

---

## 9. Rubni slučajevi

| Situacija | Ponašanje |
|---|---|
| 0 nastupa | `forma = null`, sve prazno, `lowConfidence = true` |
| 1 nastup | `forma = level = taj rezultat`, `trend = stable`, `consistency = 1`, `lowConfidence = true` |
| < 5 nastupa | Računa se normalno, ali `lowConfidence = true` (sivi prikaz, badge, `±?`) |
| Svi nastupi stariji od 300 dana osim poslednjeg | Stari se odbacuju; ostaje poslednji kao 1 tačka |
| Svi isti datum | `b = 0` (nema vremenske razlike), forma = težinski prosek |
| Usamljen stari nastup | Odbačen (MAX_AGE) ili prigušen kroz decay + confidence shrink |
| `forma > peak` | `peakProximity > 1.0` (clamp 1.05) — projektuje novi lični rekord |
| Rezultat iznad `realisticMax` | `headroom = 0`, nema uzlazne projekcije (npr. novi WR) |

---

## 10. Buduće nadogradnje

Trenutni model je dovoljno pametan za sadašnju fazu. Kad baza naraste
(stotine strelaca × desetine nastupa), prirodni sledeći koraci:

1. **Momentum u forma broj** — druga derivacija (ubrzanje), ne samo smer
2. **Percentil rangiranje** za cross-discipline poređenje ("gde si vs ostali u
   svojoj disciplini") — bez skaliranja samog broja
3. **Pravi probabilistički model** (state-space / Gaussian process) — tek sa dovoljno
   podataka, inače overfit
4. **Per-country level override** — jako državno vs slab međunarodni (vidi TODO u kodu)

Sve nadogradnje i dalje daju **jedan opipljiv broj na skali rezultata**.

---

## 11. Gde se koristi

| Fajl | Šta |
|---|---|
| `lib/forma.ts` | Jezgro |
| `strelci/[id]/page.tsx` | Profil: header broj + rolling grafik + metric strip |
| `components/shooter/FormaChart.tsx` | Grafik + metrike |
| `strelci/page.tsx` | Lista: forma po strelcu + leaderi po disciplini |
| `rangiranje/page.tsx` | Rangiranje sa kvalifikacijom |
| `page.tsx` (homepage) | Top-forma widget + club leaderboard |
| `actions.ts` | Head-to-head poređenje |
| `lib/cms/resolve-shooter.ts` | CMS embed kartica |
