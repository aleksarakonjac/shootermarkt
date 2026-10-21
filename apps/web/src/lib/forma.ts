import type { AgeCategory, eventTypeEnum } from "@shootermarkt/db/schema";

/**
 * Forma score — jedinstveni izvor istine za sve delove aplikacije. Spec: docs/forma-v2.md
 *
 * Forma = NIVO: težinski prosek skorašnjih nastupa (ono što strelac stvarno puca).
 * Težina svakog nastupa: time-decay (poluvreme 180 dana) × nivo takmičenja (level + event_type)
 * × kategorija meča × prigušenje lošeg outliera (samo naniže).
 *
 * Trend NE ulazi u broj — backtest (pnpm db:backtest-forma) pokazuje da projekcija trenda
 * povećava grešku prognoze. Trend ostaje kao strelica ↑ ↓ →: nagib iz robusnih bucket-ova,
 * projektovan jedan tipičan razmak unapred, sa težinom koja raste sa brojem nastupa.
 *
 * Težinski prosek je uvek između najslabijeg i najboljeg nastupa, pa forma ne može preći
 * ni lični peak ni maksimum discipline. Stabilnost izlazi kao zasebne metrike
 * (reliability, consistency).
 */

export type Trend = "up" | "down" | "stable";

export type CompetitionLevel =
  | "olympic" | "world" | "continental" | "international"
  | "national" | "regional" | "club";

export type CompetitionEventType = (typeof eventTypeEnum.enumValues)[number];

export type ResultCategory = AgeCategory;

export type FormaEntry = {
  score: number;
  date: string;                 // ISO YYYY-MM-DD
  level?: CompetitionLevel | null;
  eventType?: CompetitionEventType | null;
  category?: ResultCategory | null;
};

export type FormaOptions = {
  /** Kod discipline — određuje limit trenda i prag outliera. */
  code?: string;
  /** Per-discipline opseg za normalizaciju consistency (default CONSISTENCY_RANGE). */
  consistencyRange?: number;
};

export type FormaResult = {
  forma: number | null;         // težinski nivo (= level)
  level: number | null;         // isto što i forma; zadržano zbog postojećih pozivalaca
  reliability: number;          // ± težinski std oko trenda
  trend: Trend;
  momentum: number;             // ubrzava (+) / usporava (−)
  peak: number | null;
  peakProximity: number | null; // forma / peak ∈ (0, 1]
  consistency: number;          // 0–1
  sampleSize: number;
  lowConfidence: boolean;       // true ako sampleSize < RANKING_MIN_SAMPLE
};

// ── Parametri ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
/** Gornja granica broja nastupa u obračunu (stvarni limit je decay + MAX_AGE_DAYS). */
const WINDOW = 20;
/** Poluvreme time-decay-a (dana) — nastup star toliko vredi upola. */
const DECAY_HALFLIFE = 180;
const DECAY_TAU = DECAY_HALFLIFE / Math.LN2;
/** Nastupi stariji od ovoga (od poslednjeg nastupa) ne ulaze u obračun. */
const MAX_AGE_DAYS = 365;
/** Koliko dana unapred projektujemo trend za strelicu (tipičan razmak), granice. */
const STEP_MIN = 14, STEP_MAX = 60;
/** Prag (poena) iznad kog projektovani pomak broji kao ↑ / ↓. */
const TREND_EPS = 0.4;
/** Referentni opseg za normalizaciju consistency. */
const CONSISTENCY_RANGE = 15;
/** Težina trenda po broju nastupa: n ≤ 3 → 0, linearno do pune težine na TREND_FULL_N. */
const TREND_START_N = 3, TREND_FULL_N = 7;
/** Outlier: više od OUTLIER_K robusnih std ispod medijane → težina se smanjuje (Huber). */
const OUTLIER_K = 3;

/**
 * Pravila po disciplini. AR ima decimalne skorove (jedinica 0.1), ostale celobrojne.
 *   trendCap  — maksimalan projektovani pomak za strelicu (±)
 *   minSpread — donja granica robusnog rasipanja za outlier test (da MAD = 0 ne seče sve)
 */
type DisciplineRules = { trendCap: number; minSpread: number };
const RIFLE_10M: DisciplineRules = { trendCap: 1.5, minSpread: 1.0 };
const INTEGER_600: DisciplineRules = { trendCap: 3, minSpread: 2 };
const DISCIPLINE_RULES: Record<string, DisciplineRules> = {
  ARM: RIFLE_10M, ARW: RIFLE_10M,
  APM: INTEGER_600, APW: INTEGER_600,
  R3PM: INTEGER_600, R3PW: INTEGER_600, SPW: INTEGER_600,
};

/**
 * Faktor pouzdanosti signala po nivou i tipu takmičenja.
 * international ≈ national namerno (jako državno vs slab međunarodni nije uporedivo).
 */
function levelFactor(level: CompetitionLevel | null | undefined, eventType: CompetitionEventType | null | undefined): number {
  switch (level) {
    case "olympic": return 1.00;
    case "world":
      return eventType === "championship" ? 0.95
        : eventType === "world_cup" ? 0.90
        : eventType === "grand_prix" ? 0.80
        : 0.88; // netagovano svetsko takmičenje
    case "continental": return eventType === "championship" ? 0.85 : 0.72;
    case "international": return 0.68;
    case "national": return 0.68;
    case "regional": return 0.50;
    case "club": return 0.38;
    default: return 0.60;
  }
}

/**
 * Faktor pouzdanosti po kategoriji MEČA (ne uzrastu strelca). Rezultat iz slabije
 * konkurencije manje vuče zajedničku formu; sam rezultat i peak se ne menjaju.
 */
const CATEGORY_WEIGHT: Record<ResultCategory, number> = {
  pionir: 0.55,
  kadet: 0.65,
  mladji_junior: 0.75,
  junior: 0.85,
  mladji_senior: 0.93,
  senior: 1.00,
  master: 0.80,
  open: 1.00,
};
const CATEGORY_WEIGHT_DEFAULT = 0.75;

// ── Pomoćne ───────────────────────────────────────────────────────────────────

function daysBetween(aIso: string, bIso: string): number {
  return (Date.parse(aIso + "T00:00:00Z") - Date.parse(bIso + "T00:00:00Z")) / MS_PER_DAY;
}

function categoryFactor(category: ResultCategory | null | undefined): number {
  return category ? (CATEGORY_WEIGHT[category] ?? CATEGORY_WEIGHT_DEFAULT) : CATEGORY_WEIGHT_DEFAULT;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Isti skor istog dana = isti meč prijavljen na više lista (npr. senior + junior tabela).
 * Zadržava se jedan nastup, sa najjačom kategorijom.
 */
function dedupeSameMatch(entries: FormaEntry[]): FormaEntry[] {
  const byKey = new Map<string, FormaEntry>();
  for (const e of entries) {
    const key = `${e.date}|${e.score}`;
    const prev = byKey.get(key);
    if (!prev || categoryFactor(e.category) > categoryFactor(prev.category)) byKey.set(key, e);
  }
  return [...byKey.values()];
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
  // 0 / negativan skor = nema rezultata (DNS, nepotpun import) — nije nastup.
  const valid = dedupeSameMatch(entries.filter((e) => e.score > 0));
  if (valid.length === 0) return empty;

  const sorted = [...valid].sort((a, b) => a.date.localeCompare(b.date));
  const peakAll = Math.max(...sorted.map((e) => e.score));
  const rules = opts.code ? DISCIPLINE_RULES[opts.code] : undefined;
  const consistencyRange = opts.consistencyRange ?? CONSISTENCY_RANGE;

  const asOf = sorted[sorted.length - 1].date;
  const win = sorted.filter((e) => daysBetween(asOf, e.date) <= MAX_AGE_DAYS).slice(-WINDOW);
  const n = win.length;
  const lowConfidence = n < RANKING_MIN_SAMPLE;

  const t = win.map((e) => daysBetween(e.date, asOf)); // ≤ 0
  const y = win.map((e) => e.score);

  // Težine: time-decay × nivo takmičenja × kategorija meča
  const w = win.map((e, i) =>
    Math.exp(t[i] / DECAY_TAU) * levelFactor(e.level, e.eventType) * categoryFactor(e.category)
  );

  // Loš outlier (samo naniže): Huber težina k/|z| za z < −k, robusno rasipanje iz MAD.
  if (n >= 3) {
    const med = median(y);
    const spread = Math.max(1.4826 * median(y.map((v) => Math.abs(v - med))), rules?.minSpread ?? 1);
    for (let i = 0; i < n; i++) {
      const z = (y[i] - med) / spread;
      if (z < -OUTLIER_K) w[i] *= OUTLIER_K / -z;
    }
  }

  const W = w.reduce((s, x) => s + x, 0);
  const meanT = w.reduce((s, x, i) => s + x * t[i], 0) / W;
  const level = w.reduce((s, x, i) => s + x * y[i], 0) / W;

  // Nagib iz robusnih bucket-ova: novija (t ≥ meanT) vs starija polovina po centru težine.
  const idxNew: number[] = [], idxOld: number[] = [];
  for (let i = 0; i < n; i++) (t[i] >= meanT ? idxNew : idxOld).push(i);
  const bucketW = (idx: number[]) => idx.reduce((s, i) => s + w[i], 0);
  const wNew = bucketW(idxNew), wOld = bucketW(idxOld);
  const b = (() => {
    if (idxNew.length === 0 || idxOld.length === 0) return 0;
    const wMean = (idx: number[], arr: number[], ww: number) => idx.reduce((s, i) => s + w[i] * arr[i], 0) / ww;
    const dt = wMean(idxNew, t, wNew) - wMean(idxOld, t, wOld);
    const rawB = Math.abs(dt) > 1e-6 ? (wMean(idxNew, y, wNew) - wMean(idxOld, y, wOld)) / dt : 0;
    // Shrink: ne veruj trendu koji drži zanemarljiva težina (npr. usamljen stari nastup).
    return rawB * (2 * Math.min(wNew, wOld)) / (wNew + wOld);
  })();

  // Strelica: projektovani pomak od centra težine (meanT) do jednog tipičnog razmaka posle
  // poslednjeg nastupa. Ne ulazi u forma broj.
  const gaps: number[] = [];
  for (let i = 1; i < n; i++) gaps.push(daysBetween(win[i].date, win[i - 1].date));
  const stepDays = Math.max(STEP_MIN, Math.min(STEP_MAX, median(gaps) || STEP_MIN));
  const trendWeight = Math.max(0, Math.min(1, (n - TREND_START_N) / (TREND_FULL_N - TREND_START_N)));
  const cap = rules?.trendCap ?? Infinity;
  const gain = trendWeight * Math.max(-cap, Math.min(cap, b * (stepDays - meanT)));
  const forma = level;

  // Pouzdanost: težinski std reziduala oko trend-linije kroz (meanT, level)
  const wResid = w.reduce((s, x, i) => s + x * (y[i] - (level + b * (t[i] - meanT))) ** 2, 0);
  const reliability = Math.sqrt(wResid / W);
  const consistency = n === 1 ? 1 : Math.max(0, Math.min(1, 1 - reliability / consistencyRange));

  // Trend threshold skaliran sa reliability: pomak mora preći bar 25% tipičnog šuma strelca.
  const dynamicEps = Math.max(TREND_EPS, reliability * 0.25);
  const trend: Trend = gain > dynamicEps ? "up" : gain < -dynamicEps ? "down" : "stable";

  // Momentum = WLS nagib unutar novije polovine − WLS nagib unutar starije.
  const wlsSlope = (idx: number[]) => {
    if (idx.length < 2) return 0;
    const ww = bucketW(idx);
    if (ww <= 0) return 0;
    const mt = idx.reduce((s, i) => s + w[i] * t[i], 0) / ww;
    const my = idx.reduce((s, i) => s + w[i] * y[i], 0) / ww;
    const num = idx.reduce((s, i) => s + w[i] * (t[i] - mt) * (y[i] - my), 0);
    const den = idx.reduce((s, i) => s + w[i] * (t[i] - mt) ** 2, 0);
    return den === 0 ? 0 : num / den;
  };
  const momentum = wlsSlope(idxNew) - wlsSlope(idxOld);

  const peakProximity = peakAll > 0 ? forma / peakAll : null;

  return {
    forma, level, reliability, trend, momentum,
    peak: peakAll, peakProximity, consistency, sampleSize: n, lowConfidence,
  };
}

/**
 * Rolling forma za grafik — forma i ± pouzdanost NA SVAKOM nastupu (kako je izgledala tada).
 * @param entries nastupi u hronološkom redu (najstariji → najnoviji)
 */
export function rollingForma(entries: FormaEntry[], opts: FormaOptions = {}): { forma: number; reliability: number }[] {
  return entries.map((entry, i) => {
    const r = computeForma(entries.slice(0, i + 1), opts);
    return { forma: r.forma ?? entry.score, reliability: r.reliability };
  });
}

// ── Kompat / pomoćne za pozivaoce ─────────────────────────────────────────────

/** Minimalan broj nastupa da strelac uđe u rangiranje (prognoza dovoljno pouzdana). */
export const RANKING_MIN_SAMPLE = 5;

/**
 * Forma iz liste rezultata sa datumima, nivoom/tipom takmičenja i kategorijom meča.
 */
export function computeFormaFromEntries(
  entries: {
    qualTotal: number;
    date: string;
    level?: CompetitionLevel | null;
    eventType?: CompetitionEventType | null;
    category?: ResultCategory | null;
  }[],
  opts: FormaOptions = {}
): FormaResult {
  return computeForma(
    entries.map((e) => ({
      score: e.qualTotal,
      date: e.date,
      level: e.level,
      eventType: e.eventType,
      category: e.category,
    })),
    opts
  );
}

export function trendLabel(trend: Trend): string {
  return trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
}

export function trendColor(trend: Trend): string {
  return trend === "up" ? "var(--success)" : trend === "down" ? "var(--brand-primary)" : "var(--muted)";
}
