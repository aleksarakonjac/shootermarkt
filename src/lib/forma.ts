/**
 * Forma score — jedinstveni izvor istine za sve delove aplikacije.
 *
 * Forma NIJE prosek prošlih rezultata. Forma je **prognoza sledećeg nastupa**.
 * Model: weighted linear regression (težinski trend) preko poslednjih nastupa,
 * projektovan jedan tipičan razmak unapred, sa kompresijom blizu plafona discipline.
 *
 * Tri signala ulaze u težinu svakog nastupa:
 *   1. time-decay  — noviji nastupi vrede više (exp opadanje po STVARNOM datumu)
 *   2. level-weight — jače takmičenje = pouzdaniji signal (olimpijsko > … > klubsko)
 *   3. (implicitno) recentnost preko regresije trenda
 *
 * Ceiling kompresija: rast blizu realnog maksimuma discipline je teži, pa se
 * uzlazna projekcija priguši kako se nivo približava plafonu (npr. ARM WR 637.9).
 * Silazna projekcija se NE priguši.
 *
 * Forma ostaje na skali rezultata → opipljivo predviđanje. Stabilnost NE ulazi
 * u broj; izlazi kao zasebne metrike (reliability, consistency).
 */

export type Trend = "up" | "down" | "stable";

export type CompetitionLevel =
  | "olympic" | "world" | "continental" | "international"
  | "national" | "regional" | "club";

export type FormaEntry = {
  score: number;
  date: string;                 // ISO YYYY-MM-DD
  level?: CompetitionLevel | null;
};

export type FormaOptions = {
  /** Kod discipline — koristi se za ceiling kompresiju preko REALISTIC_MAX. */
  code?: string;
  /** Eksplicitni realni max (pretiče REALISTIC_MAX[code]). */
  realisticMax?: number;
  /** Per-discipline opseg za normalizaciju consistency (default CONSISTENCY_RANGE). */
  consistencyRange?: number;
};

export type FormaResult = {
  forma: number | null;         // prognoza sledećeg nastupa
  level: number | null;         // nivo na dan poslednjeg nastupa (bez projekcije)
  reliability: number;          // ± težinski std oko trenda
  trend: Trend;
  momentum: number;             // ubrzava (+) / usporava (−)
  peak: number | null;
  peakProximity: number | null; // forma / peak ∈ (0, 1.05]
  consistency: number;          // 0–1
  sampleSize: number;
  lowConfidence: boolean;       // true ako sampleSize < RANKING_MIN_SAMPLE
};

// ── Parametri ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
/** Koliko poslednjih nastupa ulazi u obračun. Stvarni limit je ipak time-decay +
 *  MAX_AGE_DAYS; ovaj broj je gornja granica da aktivni strelci koriste sve skorašnje
 *  nastupe (decay prigušuje stare, pa više tačaka samo stabilizuje procenu). */
const WINDOW = 20;
/** Poluvreme time-decay-a (dana) — nastup star toliko vredi upola. */
const DECAY_HALFLIFE = 150;
const DECAY_TAU = DECAY_HALFLIFE / Math.LN2;
/** Nastupi stariji od ovoga se odbacuju pre WINDOW slice-a (decay ih ionako gasi). */
const MAX_AGE_DAYS = 2 * DECAY_HALFLIFE; // 300 dana
/** Koliko dana unapred projektujemo (tipičan razmak), granice. */
const STEP_MIN = 14, STEP_MAX = 60;
/** Prag (poena) iznad kog projektovani pomak broji kao ↑ / ↓. */
const TREND_EPS = 0.4;
/** Referentni opseg za normalizaciju consistency. */
const CONSISTENCY_RANGE = 15;

/**
 * Faktor pouzdanosti signala po nivou takmičenja.
 * international ≈ national namerno (teško uporedivi: jako državno vs slab međunarodni).
 *
 * TODO: Per-country override — u nekim zemljama (npr. Srbija) Državno prvenstvo može
 * biti jače od slabog međunarodnog turnira. Kad baza naraste, razmotriti
 * `level_weight(level, country)` varijantu ili poseban nivo `national_strong` (weight 0.75+).
 */
const LEVEL_WEIGHT: Record<CompetitionLevel, number> = {
  olympic:       1.00,
  world:         0.92,
  continental:   0.82,
  international:  0.68,
  national:      0.68,
  regional:      0.50,
  club:          0.38,
};
const LEVEL_WEIGHT_DEFAULT = 0.60;

/**
 * Realni maksimum kvalifikacija po disciplini (blizu svetskog rekorda).
 * NIJE teorijski max — rast iznad ovoga je praktično nemoguć, pa ga koristimo
 * kao asimptotu za ceiling kompresiju.
 *   ARM/ARW: WR 637.9 (teorijski 654.0 nedostižan)
 *   APM: WR 594, APW: WR 591 (teorijski 600)
 */
export const REALISTIC_MAX: Record<string, number> = {
  ARM: 637.9, ARW: 637.9,
  APM: 594.0, APW: 591.0,
};

// ── Pomoćne ───────────────────────────────────────────────────────────────────

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00").getTime();
  const b = new Date(bIso + "T00:00:00").getTime();
  return (a - b) / 86_400_000;
}

function levelFactor(l: CompetitionLevel | null | undefined): number {
  return l ? (LEVEL_WEIGHT[l] ?? LEVEL_WEIGHT_DEFAULT) : LEVEL_WEIGHT_DEFAULT;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Jezgro ────────────────────────────────────────────────────────────────────

/**
 * @param entries nastupi u BILO KOM redosledu (sortira se interno po datumu)
 */
export function computeForma(entries: FormaEntry[], opts: FormaOptions = {}): FormaResult {
  const empty: FormaResult = {
    forma: null, level: null, reliability: 0, trend: "stable",
    momentum: 0, peak: null, peakProximity: null, consistency: 0,
    sampleSize: 0, lowConfidence: true,
  };
  if (entries.length === 0) return empty;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const peakAll = Math.max(...sorted.map((e) => e.score));

  // (Izmena 1) Efektivni prozor: odbaci nastupe starije od MAX_AGE_DAYS od poslednjeg,
  // pa tek onda uzmi poslednjih WINDOW. Decay ionako gasi stare — ovo ih izbacuje iz
  // bucket kalkulacije da usamljen prastari nastup ne pravi lažnu "staru" polovinu.
  const asOfMs = new Date(sorted[sorted.length - 1].date + "T00:00:00").getTime();
  const filtered = sorted.filter(
    (e) => (asOfMs - new Date(e.date + "T00:00:00").getTime()) / MS_PER_DAY <= MAX_AGE_DAYS
  );
  // asOf uvek prolazi filter (age 0), pa je filtered ≥ 1; fallback za svaki slučaj.
  const win = (filtered.length > 0 ? filtered : sorted.slice(-1)).slice(-WINDOW);
  const n = win.length;

  const realisticMax =
    opts.realisticMax ?? (opts.code ? REALISTIC_MAX[opts.code] : undefined);
  const consistencyRange = opts.consistencyRange ?? CONSISTENCY_RANGE;
  const lowConfidence = n < RANKING_MIN_SAMPLE;

  if (n === 1) {
    return {
      forma: win[0].score, level: win[0].score, reliability: 0, trend: "stable",
      momentum: 0, peak: peakAll,
      peakProximity: peakAll > 0 ? Math.min(win[0].score / peakAll, 1.05) : null,
      consistency: 1, sampleSize: 1, lowConfidence,
    };
  }

  // asOf = datum poslednjeg nastupa; t_i = dani pre asOf (≤ 0)
  const asOf = win[n - 1].date;
  const t = win.map((e) => daysBetween(e.date, asOf)); // ≤ 0
  const y = win.map((e) => e.score);

  // Težine: time-decay × level-weight
  const w = win.map((e, i) =>
    Math.exp(t[i] / DECAY_TAU) * levelFactor(e.level)
  );
  const W = w.reduce((s, x) => s + x, 0);
  const meanT = w.reduce((s, x, i) => s + x * t[i], 0) / W;
  const meanY = w.reduce((s, x, i) => s + x * y[i], 0) / W;

  // Bucket-ovi: novija (t ≥ meanT) vs starija (t < meanT) polovina po centru težine.
  const idxNew: number[] = [], idxOld: number[] = [];
  for (let i = 0; i < n; i++) (t[i] >= meanT ? idxNew : idxOld).push(i);
  const bucketW = (idx: number[]) => idx.reduce((s, i) => s + w[i], 0);
  const wNew = bucketW(idxNew), wOld = bucketW(idxOld);

  // Nagib iz robusnih bucket-ova — daleke tačke ne dominiraju nagib preko t² leverage-a.
  const b = (() => {
    if (idxNew.length === 0 || idxOld.length === 0) return 0;
    const wMean = (idx: number[], arr: number[], ww: number) =>
      ww > 0 ? idx.reduce((s, i) => s + w[i] * arr[i], 0) / ww : 0;
    const yNew = wMean(idxNew, y, wNew), yOld = wMean(idxOld, y, wOld);
    const tNew = wMean(idxNew, t, wNew), tOld = wMean(idxOld, t, wOld);
    const rawB = Math.abs(tNew - tOld) > 1e-6 ? (yNew - yOld) / (tNew - tOld) : 0;
    // Shrink: ne veruj trendu koji drži zanemarljiva težina (npr. usamljen stari nastup).
    const confidence = (2 * Math.min(wNew, wOld)) / (wNew + wOld); // ∈ [0,1]
    return rawB * confidence;
  })();

  // (Izmena 7) `level` je procenjeni nivo strelca NA DAN POSLEDNJEG NASTUPA (asOf),
  // ne na današnji datum. Forma = level + projektovani gain unapred. Za rolling grafik
  // ovo je ispravno. Za "koliko je jak danas" — koristiti `forma`.
  const a = meanY - b * meanT;   // nivo projektovan na asOf (t=0)
  const levelNow = a;

  // Projekcija: tipičan razmak unapred
  const gaps: number[] = [];
  for (let i = 1; i < n; i++) gaps.push(daysBetween(win[i].date, win[i - 1].date));
  const stepDays = Math.max(STEP_MIN, Math.min(STEP_MAX, median(gaps) || STEP_MIN));

  let gain = b * stepDays; // doprinos trenda

  // Ceiling kompresija — samo uzlazni deo, blizu plafona teže
  if (gain > 0 && realisticMax !== undefined) {
    const headroom = Math.max(0, realisticMax - levelNow);
    // meko asimptotsko zasićenje: gain nikad ne probije headroom
    gain = headroom > 1e-6 ? headroom * (1 - Math.exp(-gain / headroom)) : 0;
  }

  const forma = levelNow + gain;

  // Pouzdanost: težinski std rezidualа oko trend-linije (računa se PRE trenda)
  const wResid = win.reduce((s, _e, i) => {
    const pred = a + b * t[i];
    return s + w[i] * (y[i] - pred) ** 2;
  }, 0);
  const reliability = Math.sqrt(wResid / W);
  const consistency = Math.max(0, Math.min(1, 1 - reliability / consistencyRange));

  // (Izmena 2) Trend threshold skaliran sa reliability: da bi bio trend, pomak mora
  // preći bar 25% tipičnog šuma strelca. TREND_EPS je donja granica (floor).
  const dynamicEps = Math.max(TREND_EPS, reliability * 0.25);
  const trend: Trend =
    gain > dynamicEps ? "up" : gain < -dynamicEps ? "down" : "stable";

  // (Izmena 3) Momentum = WLS nagib unutar novije polovine − WLS nagib unutar starije.
  // Iste bucket-ove kao glavni nagib; WLS unutar polovine (bez rekurzije).
  const wlsSlope = (idx: number[]) => {
    if (idx.length < 2) return 0;
    const ww = idx.reduce((s, i) => s + w[i], 0);
    if (ww <= 0) return 0;
    const mt = idx.reduce((s, i) => s + w[i] * t[i], 0) / ww;
    const my = idx.reduce((s, i) => s + w[i] * y[i], 0) / ww;
    const num = idx.reduce((s, i) => s + w[i] * (t[i] - mt) * (y[i] - my), 0);
    const den = idx.reduce((s, i) => s + w[i] * (t[i] - mt) ** 2, 0);
    return den === 0 ? 0 : num / den;
  };
  const momentum = wlsSlope(idxNew) - wlsSlope(idxOld);

  // (Izmena 5) peakProximity clamp na 1.05: forma > peak je validno (bolji nego ikad),
  // ali ne dozvoljava se >105% da progress bar ne pukne. UI tretira >1.0 posebno.
  const peakProximity = peakAll > 0 ? Math.min(forma / peakAll, 1.05) : null;

  return {
    forma, level: levelNow, reliability, trend, momentum,
    peak: peakAll, peakProximity, consistency, sampleSize: n, lowConfidence,
  };
}

/**
 * Rolling forma za grafik — vrednost forme NA SVAKOM nastupu (kako je izgledala tada).
 * @param entries nastupi u hronološkom redu (najstariji → najnoviji)
 */
export function rollingForma(entries: FormaEntry[], opts: FormaOptions = {}): number[] {
  return entries.map((_, i) => {
    const upto = entries.slice(0, i + 1);
    const r = computeForma(upto, opts);
    return r.forma ?? upto[upto.length - 1].score;
  });
}

// ── Kompat / pomoćne za pozivaoce ─────────────────────────────────────────────

/** Minimalan broj nastupa da strelac uđe u rangiranje (prognoza dovoljno pouzdana). */
export const RANKING_MIN_SAMPLE = 5;

/**
 * Forma iz liste rezultata sa datumima (i opciono nivoom takmičenja).
 */
export function computeFormaFromEntries(
  entries: { qualTotal: number; date: string; level?: CompetitionLevel | null }[],
  opts: FormaOptions = {}
): FormaResult {
  return computeForma(
    entries.map((e) => ({ score: e.qualTotal, date: e.date, level: e.level })),
    opts
  );
}

export function trendLabel(trend: Trend): string {
  return trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
}

export function trendColor(trend: Trend): string {
  return trend === "up" ? "var(--success)" : trend === "down" ? "var(--brand-primary)" : "var(--muted)";
}
