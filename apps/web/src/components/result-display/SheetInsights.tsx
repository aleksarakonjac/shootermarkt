"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getFormaHistory, type FormaHistoryPoint } from "@/app/(site)/[locale]/(public)/[scope]/actions";
import { trendColor, trendLabel, type Trend } from "@/lib/forma";
import { SheetDots, SheetSection } from "./ResultSheet";

const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

/** Pre-izračunata forma (shooter_forma_cache) za jednog strelca u jednoj disciplini. */
export type SheetForma = { forma: number | null; trend: Trend | null; peak: number | null; seasonAvg: number | null; seasonCount: number; careerCount: number };

/** Drugi nastup istog strelca na ovom takmičenju (druga disciplina, meč ili lista). */
export type SheetOtherResult = { id: number; label: string; total: string | null; rank: number | null; stage: "qual" | "final" };

type Ctx = {
  forma: Record<string, SheetForma>;
  othersFor: (shooterId: number, excludeResultId: number) => SheetOtherResult[];
};

const SheetInsightsContext = createContext<Ctx>({ forma: {}, othersFor: () => [] });

export function SheetInsightsProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <SheetInsightsContext.Provider value={value}>{children}</SheetInsightsContext.Provider>;
}

export const formaKey = (shooterId: number, code: string) => `${shooterId}|${code}`;

const historyCache = new Map<string, Promise<FormaHistoryPoint[]>>();

/** Krugovi = skorovi poslednjih nastupa, linija = forma tada; trenutni nastup je pun krug. Učitava se tek kad se sheet otvori. */
function FormaHistoryChart({ shooterId, code, total, en }: { shooterId: number; code: string; total: number | null; en: boolean }) {
  const [pts, setPts] = useState<FormaHistoryPoint[] | null>(null);
  useEffect(() => {
    let live = true;
    const key = `${shooterId}|${code}|${en ? "en" : "sr"}`;
    if (!historyCache.has(key)) historyCache.set(key, getFormaHistory(shooterId, code, en ? "en" : "sr").catch(() => { historyCache.delete(key); return []; }));
    setPts(null);
    historyCache.get(key)!.then((p) => live && setPts(p));
    return () => { live = false; };
  }, [shooterId, code, en]);
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [shooterId, code]);
  if (pts == null) return <div className="mt-3 mb-8 ml-11 h-28 animate-pulse rounded bg-[var(--surface)] motion-reduce:animate-none" aria-hidden="true" />;
  if (pts.length < 3) return null;
  const scores = pts.map((p) => p.score);
  const cur = total != null ? scores.lastIndexOf(total) : -1;
  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${day}.${m}.${y.slice(2)}.`; };
  return (
    <div className="mt-3">
      <SheetDots values={scores} line={pts.map((p) => p.forma)} current={cur >= 0 ? cur : undefined} xLabels={[fmtDate(pts[0].date), fmtDate(pts[pts.length - 1].date)]}
        picked={picked} onPick={setPicked}
        popover={picked != null && (
          <>
            <p className={`text-lg font-bold tabular-nums text-[var(--ink)] ${MONO}`}>{pts[picked].score}</p>
            {pts[picked].name && <p className="font-medium leading-snug text-[var(--ink)]">{pts[picked].name}</p>}
            <p className="mt-0.5 text-[var(--muted)]">{fmtDate(pts[picked].date)}{pts[picked].location ? ` · ${pts[picked].location}` : ""}</p>
          </>
        )}
        ariaLabel={en ? `Last ${pts.length} results and form: ${scores.join(", ")}` : `Poslednjih ${pts.length} nastupa i forma: ${scores.join(", ")}`} />
    </div>
  );
}

const signed = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)}`;

/**
 * Kontekst strelca ispod serija: forma + trend, lični rekord, odnos prema proseku kalendarske godine,
 * H2H prečica i ostali nastupi na istom takmičenju. `total` samo za kvalifikacioni sheet —
 * forma i peak se računaju iz kvalifikacionih skorova, pa se u finalu ne poredi.
 */
export function SheetInsights({ shooterId, code, resultId, total, en }: {
  shooterId: number; code?: string; resultId: number; total?: number | null; en: boolean;
}) {
  const ctx = useContext(SheetInsightsContext);
  // Bez koda (miks tim) uzimamo disciplinu u kojoj strelac ima najviše nastupa.
  const f = code
    ? ctx.forma[formaKey(shooterId, code)]
    : Object.entries(ctx.forma).filter(([k]) => k.startsWith(`${shooterId}|`)).map(([, v]) => v).sort((a, b) => b.careerCount - a.careerCount)[0];
  const others = ctx.othersFor(shooterId, resultId);
  const isPeak = f?.peak != null && total != null && f.careerCount >= 2 && total >= f.peak;
  const vsSeason = f?.seasonAvg != null && total != null && f.seasonCount >= 3 ? Math.round((total - f.seasonAvg) * 10) / 10 : null;
  if (!f?.forma && !others.length) return null;

  return (
    <>
      {f?.forma != null && (
        <SheetSection title={en ? "Form" : "Forma"}>
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl sm:text-2xl font-bold leading-none tabular-nums text-[var(--ink)] ${MONO}`}>{f.forma.toFixed(1)}</span>
              {f.trend && <span className="text-xl font-bold leading-none" style={{ color: trendColor(f.trend) }} aria-label={en ? `Trend ${f.trend}` : `Trend ${f.trend === "up" ? "raste" : f.trend === "down" ? "pada" : "stabilan"}`}>{trendLabel(f.trend)}</span>}
            </div>
            {f.peak != null && (
              <p className="text-right text-base sm:text-sm text-[var(--muted)]">
                {en ? "Personal best" : "Lični rekord"}{" "}
                <span className={`text-xl sm:text-lg font-bold tabular-nums text-[var(--ink)] ${MONO}`}>{f.peak.toFixed(1)}</span>
              </p>
            )}
          </div>
          {code && total != null && <FormaHistoryChart shooterId={shooterId} code={code} total={total} en={en} />}
          {(isPeak || vsSeason != null) && (
            <ul className="space-y-1 text-base sm:text-sm">
              {isPeak && <li className="font-semibold" style={{ color: "var(--success)" }}>{en ? "New personal best" : "Novi lični rekord"}</li>}
              {vsSeason != null && (
                <li className="text-[var(--muted)]">
                  <span className={`font-semibold tabular-nums ${MONO}`} style={{ color: vsSeason > 0 ? "var(--success)" : "var(--ink)" }}>{signed(vsSeason)}</span>{" "}
                  {en ? `vs this year's average (${f.seasonAvg!.toFixed(1)})` : `u odnosu na prosek ove godine (${f.seasonAvg!.toFixed(1)})`}
                </li>
              )}
            </ul>
          )}
        </SheetSection>
      )}
      {others.length > 0 && (
        <SheetSection title={en ? "Also at this competition" : "Još na ovom takmičenju"}>
          <ul className="divide-y divide-[var(--border)] text-base sm:text-sm">
            {others.map((o) => (
              <li key={o.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 break-words text-[var(--muted)]">{o.label}</span>
                <span className={`shrink-0 tabular-nums text-[var(--ink)] ${MONO}`}>
                  {o.total ?? "—"}{o.rank != null && <span className="ml-2 text-sm text-[var(--muted)]">#{o.rank}</span>}
                </span>
              </li>
            ))}
          </ul>
        </SheetSection>
      )}
    </>
  );
}

/**
 * Razlika u zbiru posle svakog hica/serije u odnosu na referentnog strelca (pobednik, ili drugi ako je ovo pobednik).
 * Pokazuje gde je finale dobijeno ili izgubljeno — sirov kumulativ je skoro prava linija i ništa ne kaže.
 */
export function SheetGapLine({ points, refName, en }: { points: number[]; refName: string; en: boolean }) {
  if (points.length < 3) return null;
  const W = 300, H = 88, PAD = 6;
  const span = Math.max(0.5, ...points.map(Math.abs));
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H / 2 - (v / span) * (H / 2 - PAD);
  const last = points[points.length - 1];
  const desc = en
    ? `Gap to ${refName} after each step, ending at ${signed(last)}`
    : `Razlika prema ${refName} posle svakog koraka, na kraju ${signed(last)}`;
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={desc} preserveAspectRatio="none">
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--border-strong)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polyline fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={points.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
      </svg>
      <figcaption className="mt-1 flex items-baseline justify-between gap-3 text-sm text-[var(--muted)]">
        <span>{en ? `vs ${refName}` : `prema: ${refName}`}</span>
        <span className={`font-semibold tabular-nums text-[var(--ink)] ${MONO}`}>{signed(last)}</span>
      </figcaption>
    </figure>
  );
}
