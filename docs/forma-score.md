# Forma Score — dokumentacija (v2)

> Jedinstveni izvor istine: [`apps/web/src/lib/forma.ts`](../apps/web/src/lib/forma.ts)
> Odluke i istorija redizajna: [forma-v2.md](forma-v2.md)
> Svi delovi aplikacije (profil, lista strelaca, rangiranje, homepage, h2h, CMS) koriste ovaj jedan modul.

---

## 1. Šta je Forma Score

Forma je **procena trenutnog nivoa strelca**: težinski prosek skorašnjih nastupa, na skali
stvarnog rezultata (npr. `624.3` za vazdušnu pušku, `577` za vazdušni pištolj).

Istovremeno je i najbolja prognoza sledećeg nastupa koju podaci dozvoljavaju. Backtest je pokazao
da projekcija trenda (v1) **povećava** grešku prognoze, pa trend više ne ulazi u broj, nego se
prikazuje kao strelica ↑ ↓ →.

Pošto je težinski prosek uvek između najslabijeg i najboljeg nastupa, forma **ne može** preći
lični peak ni maksimum discipline.

### Zašto na skali rezultata (a ne 0–100)

`624.3` strelac i trener odmah razumeju. Cena: puška i pištolj nisu direktno uporedivi, ali to
poređenje ionako nema smisla.

---

## 2. Algoritam

### 2.1 Ulaz i čišćenje

`FormaEntry { score, date, level?, eventType?, category? }`, bilo koji redosled.

1. Skor ≤ 0 se ignoriše (nema rezultata).
2. Rezultati sa `qual_remark` DNF / DNS / DSQ se ne učitavaju (`forma-query.ts`).
3. **Isti meč na više lista:** isti skor istog dana = isti meč (npr. senior + junior tabela) →
   broji se jednom, sa najjačom kategorijom.
4. Prozor: nastupi do **365 dana** pre poslednjeg nastupa, najviše poslednjih **20**.

### 2.2 Težina svakog nastupa

```
w = time-decay × nivo takmičenja × kategorija meča × outlier faktor
```

**Time-decay:** `exp(−starost / τ)`, poluvreme **180 dana** (nastup star pola godine vredi upola).

**Nivo takmičenja** iz para `level` + `event_type`:

| level + event_type | težina |
|---|---|
| olympic | 1.00 |
| world + championship | 0.95 |
| world + world_cup (uklj. Finale SK) | 0.90 |
| world + ostalo (netagovano) | 0.88 |
| continental + championship | 0.85 |
| world + grand_prix | 0.80 |
| continental + ostalo | 0.72 |
| international / national | 0.68 |
| regional | 0.50 |
| club | 0.38 |
| nepoznato | 0.60 |

**Kategorija meča** (`results.category` = kategorija meča u kom je rezultat ispucan, ne uzrast
strelca): pionir 0.55, kadet 0.65, mlađi junior 0.75, junior 0.85, mlađi senior 0.93,
senior/open 1.00, master 0.80, nepoznato 0.75.

**Outlier (samo naniže):** nastup više od 3 robusna std (1.4826·MAD oko medijane) ispod medijane
dobija Huber težinu `3 / |z|`. Jedan raspad ne obara nivo; ponovljen pad pomera medijanu i dobija
punu težinu. Dobri nastupi se ne prigušuju.

### 2.3 Forma

```
forma = level = Σ w·score / Σ w
```

### 2.4 Trend (samo strelica)

1. Nastupi se dele na noviju i stariju polovinu po težinskom centru vremena.
2. Nagib = razlika težinskih proseka / razlika težinskih vremena, prigušen ako jedna polovina
   ima zanemarljivu težinu.
3. Projektovani pomak = nagib × (tipičan razmak + udaljenost centra težine), ograničen na
   **±1.5 (AR) / ±3 (ostalo)**, sa težinom po broju nastupa: n ≤ 3 → 0, 4 → 0.25 … ≥ 7 → 1.
4. ↑ / ↓ ako pomak pređe `max(0.4, 0.25 × reliability)`, inače →.

---

## 3. Izlazne metrike

| Metrika | Značenje |
|---|---|
| `forma` | težinski nivo (glavni broj) |
| `level` | isto što i `forma` (zadržano zbog pozivalaca i keša) |
| `reliability` | ± težinski std reziduala oko trend-linije |
| `trend` | ↑ ↓ → |
| `momentum` | nagib novije polovine − nagib starije (ubrzava li se promena) |
| `peak` | najbolji rezultat ikad |
| `peakProximity` | forma / peak ∈ (0, 1] |
| `consistency` | `1 − reliability / 15`, ograničeno na 0–1 |
| `sampleSize` | broj nastupa u obračunu |
| `lowConfidence` | `sampleSize < 5` |

---

## 4. Rangiranje

- primarni ključ = **forma**, opadajuće
- kvalifikacija: **≥ 5 nastupa** (`RANKING_MIN_SAMPLE`) i **nastup u poslednjih 365 dana**
- tiebreak: peak → sampleSize
- reliability/consistency su zasebne kolone, nikad u broju

---

## 5. Validacija — backtest

```bash
pnpm --filter @shootermarkt/web db:backtest-forma
```

Za svaki nastup forma se računa **samo iz ranijih nastupa** i poredi sa stvarnim rezultatom.
Ispis: MAE i bias po disciplini, naivni baseline-i (poslednji rezultat, prosek poslednjih 5) i broj
prognoza iznad peak-a / maksimuma. Svaka izmena parametara mora da prođe ovu proveru.

Rezultat pri uvođenju v2 (2026-10-21, prognoze sa ≥ 5 ranijih nastupa, n = 910):

| model | MAE |
|---|---|
| v1 (projekcija trenda) | 3.81 |
| poslednji rezultat | 3.71 |
| prosek poslednjih 5 | 2.96 |
| **v2** | **2.94** |

Preostali bias ≈ +0.3 (forma blago precenjuje) — kandidat za fazu 2 (težina takmičenja).

---

## 6. Rubni slučajevi

| Situacija | Ponašanje |
|---|---|
| 0 nastupa | `forma = null`, `lowConfidence = true` |
| 1 nastup | forma = taj rezultat, `trend = stable`, `consistency = 1` |
| < 5 nastupa | računa se normalno, ali `lowConfidence = true` (sivi prikaz, `±?`) |
| Pauza > 365 dana | forma ostaje (nivo na poslednjem nastupu), strelac ispada iz rang liste |
| Isti skor istog dana dvaput | broji se jednom |

---

## 7. API

```ts
computeForma(entries: FormaEntry[], opts?: { code?: string; consistencyRange?: number }): FormaResult
rollingForma(entries: FormaEntry[], opts?): number[]       // forma na svakom nastupu (grafik)
computeFormaFromEntries({ qualTotal, date, level, eventType, category }[], opts?): FormaResult
trendLabel(trend), trendColor(trend)
RANKING_MIN_SAMPLE = 5
```

`opts.code` bira limit trenda i prag outliera po disciplini.

---

## 8. Sledeće faze

Vidi [forma-v2.md](forma-v2.md#faze): težina takmičenja/strelišta, razvojna kriva juniora,
"rđa" posle pauze. Svaki faktor ulazi samo ako backtest pokaže manju grešku.

---

## 9. Gde se koristi

| Fajl | Šta |
|---|---|
| `lib/forma.ts` | Jezgro |
| `lib/forma-query.ts` | Jedini upit za ulaz forme (filtrira nule i DNF/DNS/DSQ) |
| `lib/forma-cache.ts` | Keš (`shooter_forma_cache`), preračun posle svakog importa |
| `strelci/[id]/page.tsx` | Profil: header broj + grafik + metric strip |
| `components/shooter/FormaChart.tsx` | Grafik + metrike |
| `strelci/page.tsx` | Lista: forma po strelcu + leaderi po disciplini |
| `rangiranje/page.tsx` | Rangiranje sa kvalifikacijom |
| `page.tsx` (homepage) | Top-forma widget + club leaderboard |
| `actions.ts` | Head-to-head poređenje |
| `lib/cms/resolve-shooter.ts` | CMS embed kartica |
| `scripts/backtest-forma.ts` | Backtest |
