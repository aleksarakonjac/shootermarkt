"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { rollingForma, type CompetitionLevel, type ResultCategory } from "@/lib/forma";
import { FormaScoreMark } from "./FormaScoreMark";
import { DisciplineSelector, DISCIPLINE_COLOR } from "./DisciplineSelector";

export type ChartPoint = {
  date: string;
  score: number;
  discipline: string;
  competitionId: number;
  competitionName: string;
  level?: CompetitionLevel | null;
  category?: ResultCategory | null;
};

export type FormaScore = {
  score: number;               // forma (prognoza)
  trend: "up" | "down" | "stable";
  level: number;               // trenutni nivo bez projekcije
  reliability: number;         // ± raspon
  peakProximity: number | null;// 0–1.05
  consistency: number;         // 0–1
  momentum: number;
  sampleSize: number;
  lowConfidence: boolean;      // sampleSize < 5 → procena nepouzdana
};

const WINDOW = 10;
const SLIDE_DUR = 0.9;
const SLIDE_EASE = [0.76, 0, 0.24, 1] as const;

const SR_MONTHS = ["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtShort(iso: string, locale: string) {
  const d = new Date(iso + "T00:00:00");
  return `${(locale === "en" ? EN_MONTHS : SR_MONTHS)[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}
function fmtFull(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}

function subscribeToViewportWidth(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function getViewportWidth() {
  return window.innerWidth;
}

function getServerViewportWidth() {
  return 1200;
}

function TrendArrow({ trend }: { trend: "up"|"down"|"stable" }) {
  const path = trend === "up"
    ? "M6.5 11V2M2.5 6l4-4 4 4"
    : trend === "down"
    ? "M6.5 2v9M2.5 7l4 4 4-4"
    : "M2.5 6.5h8M8 3l3 3.5-3 3";
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{display:"inline-block",verticalAlign:"middle"}} aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Chart geometry ────────────────────────────────────────────────────────────

const H = 180;
const ML = 52, MR = 12, MT = 12, MB = 28;
const CH = H - MT - MB;

function buildWindow(data: ChartPoint[], yValues: number[], CW: number, maxScore: number) {
  if (yValues.length === 0) return null;
  const hi = Math.max(...yValues), lo = Math.min(...yValues);
  const pad = Math.max((hi - lo) / 3, 1);
  const yMin = Math.max(0, lo - pad);
  const naturalYMax = hi + pad;
  const yMax = Math.min(naturalYMax, maxScore) > yMin ? Math.min(naturalYMax, maxScore) : naturalYMax;
  const yRange = Math.max(yMax - yMin, 1);
  const sy = (s: number) => MT + CH - ((s - yMin) / yRange) * CH;
  const sx = (i: number) => data.length <= 1 ? ML + CW / 2 : ML + (i / (data.length - 1)) * CW;
  const pts: [number, number][] = yValues.map((v, i) => [sx(i), sy(v)]);

  function smoothCurve(pts: [number, number][], tension = 0.35): string {
    if (pts.length < 2) return "";
    if (pts.length === 2) return `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]}`;
    const t = (i: number): [number, number] => {
      const p = pts[Math.max(0, i - 1)];
      const n = pts[Math.min(pts.length - 1, i + 1)];
      return [(n[0] - p[0]) * tension, (n[1] - p[1]) * tension];
    };
    let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [tx1, ty1] = t(i), [tx2, ty2] = t(i + 1);
      d += ` C ${(pts[i][0] + tx1).toFixed(1)},${(pts[i][1] + ty1).toFixed(1)} ${(pts[i+1][0] - tx2).toFixed(1)},${(pts[i+1][1] - ty2).toFixed(1)} ${pts[i+1][0].toFixed(1)},${pts[i+1][1].toFixed(1)}`;
    }
    return d;
  }

  const line = smoothCurve(pts);
  const bottom = MT + CH;
  const area = line ? `${line} L ${pts[pts.length-1][0].toFixed(1)},${bottom} L ${pts[0][0].toFixed(1)},${bottom} Z` : "";

  const range = yMax - yMin;
  const step = range < 10 ? 1 : range < 20 ? 2 : 5;
  const yTicks: number[] = [];
  for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) yTicks.push(y);

  return { pts, line, area, sy, sx, yTicks };
}

// ── SVG window layer ──────────────────────────────────────────────────────────

interface LayerProps {
  data: ChartPoint[];
  built: NonNullable<ReturnType<typeof buildWindow>>;
  chartWidth: number;
  color: string;
  locale: string;
  showLabels: boolean;
  hoverIdx: number | null;
  onHover?: (i: number) => void;
  xInitial: number;
  xAnimate: number;
  onAnimationComplete?: () => void;
}

function ChartLayer({ data, built, chartWidth, color, locale, showLabels, hoverIdx, onHover, xInitial, xAnimate, onAnimationComplete }: LayerProps) {
  const { pts, line, area, sx } = built;
  const maxLabels = Math.max(2, Math.floor(chartWidth / 96));
  const every = Math.max(1, Math.ceil((data.length - 1) / (maxLabels - 1)));

  return (
    <motion.g
      initial={{ x: xInitial }}
      animate={{ x: xAnimate }}
      transition={{ duration: SLIDE_DUR, ease: SLIDE_EASE }}
      onAnimationComplete={onAnimationComplete}
    >
      {area && <path d={area} fill={color} fillOpacity={0.1} stroke="none" />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {pts.map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx.toFixed(1)} cy={cy.toFixed(1)}
          r={hoverIdx === i ? "5" : "3.5"}
          fill={hoverIdx === i ? color : "var(--bg)"}
          stroke={color} strokeWidth="2"
          onMouseEnter={onHover ? () => onHover(i) : undefined}
          style={{ cursor: onHover ? "crosshair" : "default" }}
        />
      ))}
      {showLabels && data.map((p, i) => {
        if (i % every !== 0 && i !== data.length - 1) return null;
        const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
        return (
          <text key={i} x={sx(i).toFixed(1)} y={H - 6} textAnchor={anchor} fill="var(--subtle)" fontSize="11" fontWeight="600">
            {fmtShort(p.date, locale)}
          </text>
        );
      })}
      {hoverIdx !== null && (
        <line
          x1={sx(hoverIdx).toFixed(1)} y1={MT}
          x2={sx(hoverIdx).toFixed(1)} y2={MT + CH}
          stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 3"
        />
      )}
    </motion.g>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface FormaChartProps {
  points: ChartPoint[];
  disciplines: { code: string; maxScore: number }[];
  formaScores: Record<string, FormaScore | null>;
  locale?: string;
  noDataLabel?: string;
  competitionUrlBase?: string;
}

export function FormaChart({
  points,
  disciplines,
  formaScores,
  locale = "sr",
  noDataLabel = "Nema dovoljno podataka",
  competitionUrlBase = "/takmicenja",
}: FormaChartProps) {
  const available = disciplines.filter(d => points.some(p => p.discipline === d.code));
  const [disc, setDisc] = useState(available[0]?.code ?? "");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const vpW = useSyncExternalStore(subscribeToViewportWidth, getViewportWidth, getServerViewportWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(0);

  const [mode, setMode] = useState<"forma" | "nastup">("forma");

  const allData = points
    .filter(p => p.discipline === disc)
    .sort((a, b) => a.date.localeCompare(b.date));

  const [windowOffset, setWindowOffset] = useState(0);

  // Prev window kept alive during slide-out
  const [prevSlice, setPrevSlice] = useState<{ data: ChartPoint[]; yValues: number[]; xExit: number } | null>(null);
  const [navDir, setNavDir] = useState<"left" | "right" | null>(null);
  const isAnimating = prevSlice !== null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setSvgW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxScore = disciplines.find(d => d.code === disc)?.maxScore ?? 630;
  const color = DISCIPLINE_COLOR[disc] ?? "#C20000";
  const forma = formaScores[disc];
  const forma_trend_color = forma?.trend === "up" ? "#15803d" : forma?.trend === "down" ? "#C20000" : "#888";

  const en = locale === "en";
  const t = {
    reliability: en ? "Prediction confidence range (±)" : "Raspon pouzdanosti prognoze (±)",
    level:       en ? "Level" : "Nivo",
    peak:        "Peak",
    consistency: (c: number) =>
      c >= 0.75 ? (en ? "Stable" : "Stabilan")
      : c >= 0.5 ? (en ? "Variable" : "Promenljiv")
      : (en ? "Volatile" : "Nestabilan"),
    momentumUp:   en ? "accelerating" : "ubrzava",
    momentumDown: en ? "slowing" : "usporava",
    lowConfidence: en
      ? "Unreliable estimate — fewer than 5 starts"
      : "Procena nepouzdana — manje od 5 nastupa",
    lowConfidenceBadge: en ? "low data" : "malo podataka",
    actualPerformances: en
      ? "Actual qualification results by appearance"
      : "Ostvareni kvalifikacioni rezultati po nastupima",
  };

  const CW = svgW > 0 ? svgW - ML - MR : 600;
  const W = svgW > 0 ? svgW : 700;
  const maxWindowOffset = Math.max(0, allData.length - WINDOW);
  const effectiveWindowOffset = Math.min(windowOffset, maxWindowOffset);
  const windowEnd = Math.max(0, allData.length - effectiveWindowOffset);
  const windowStart = Math.max(0, windowEnd - WINDOW);
  const data = allData.slice(windowStart, windowEnd);
  const canGoBack = windowStart > 0;
  const canGoForward = windowEnd < allData.length;

  const allFormaValues = rollingForma(
    allData.map(p => ({ score: p.score, date: p.date, level: p.level, category: p.category })),
    { code: disc }
  );
  const allDisplayValues = mode === "forma" ? allFormaValues : allData.map(p => p.score);
  const yValues = allDisplayValues.slice(windowStart, windowEnd);

  const built = buildWindow(data, yValues, CW, maxScore);
  const prevBuilt = prevSlice ? buildWindow(prevSlice.data, prevSlice.yValues, CW, maxScore) : null;

  function navigate(dir: "left" | "right") {
    if (isAnimating) return;
    const step = Math.floor(WINDOW / 2);
    const newOffset = dir === "right"
      ? Math.min(maxWindowOffset, effectiveWindowOffset + step)
      : Math.max(0, effectiveWindowOffset - step);
    if (newOffset === effectiveWindowOffset) return;

    // Snapshot current slice before updating windowEnd
    const snapStart = Math.max(0, windowEnd - WINDOW);
    const currentData = allData.slice(snapStart, windowEnd);
    const currentYValues = allDisplayValues.slice(snapStart, windowEnd);
    const xExit = dir === "right" ? CW : -CW;

    setPrevSlice({ data: currentData, yValues: currentYValues, xExit });
    setNavDir(dir);
    setHoverIdx(null);
    setTooltipPos(null);
    setWindowOffset(newOffset);
  }

  function selectDiscipline(nextDisc: string) {
    setDisc(nextDisc);
    setWindowOffset(0);
    setHoverIdx(null);
    setTooltipPos(null);
    setPrevSlice(null);
    setNavDir(null);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!containerRef.current || isAnimating || !built) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    let closest = 0, minDist = Infinity;
    data.forEach((_, i) => {
      const x = built.sx(i);
      const dist = Math.abs(x - relX);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setHoverIdx(closest);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }

  if (allData.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-10 text-center text-sm text-[var(--muted)]">
        {noDataLabel}
      </div>
    );
  }

  const hovPt = hoverIdx !== null ? data[hoverIdx] : null;
  const hovForma = hoverIdx !== null ? yValues[hoverIdx] : null;
  const TIP_W = 220, TIP_H = mode === "forma" ? 132 : 115;
  const tipX = tooltipPos ? (tooltipPos.x + 16 + TIP_W > vpW ? tooltipPos.x - TIP_W - 16 : tooltipPos.x + 16) : 0;
  const tipY = tooltipPos ? Math.max(8, tooltipPos.y - TIP_H / 2) : 0;

  // Entrance direction for new window
  const xEnter = navDir === "right" ? -CW : navDir === "left" ? CW : 0;

  return (
    <>
      {/* Floating tooltip */}
      {hovPt && tooltipPos && hovForma !== null && (
        <div className="fixed z-50 pointer-events-none" style={{ left: tipX, top: tipY, width: TIP_W }}>
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-xl px-3 py-2.5">
            <p style={{ color, fontFamily: "var(--font-jetbrains-mono,monospace)", fontWeight: 700, fontSize: "1.25rem", lineHeight: 1 }}>
              {hovForma.toFixed(1)}
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 3, fontFamily: "var(--font-jetbrains-mono,monospace)" }}>
              {fmtFull(hovPt.date)}
            </p>
            <div className="flex items-start gap-2" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <Link
                href={`${competitionUrlBase}/${hovPt.competitionId}`}
                className="pointer-events-auto min-w-0 flex-1 hover:underline"
                style={{ color: "var(--ink)", fontSize: "0.75rem", lineHeight: 1.4 }}
              >
                {hovPt.competitionName}
              </Link>
              {mode === "forma" && (
                <span
                  title={locale === "en" ? "Qualification result" : "Kvalifikacioni rezultat"}
                  className="shrink-0"
                  style={{ color: "var(--muted)", fontFamily: "var(--font-jetbrains-mono,monospace)", fontSize: "0.75rem", fontWeight: 700, lineHeight: 1.4 }}
                >
                  {hovPt.score % 1 === 0 ? hovPt.score : hovPt.score.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-[var(--border)]">
          <div className="flex gap-1.5 flex-wrap items-center">

            {available.length === 1 ? (
              <span
                className="text-[14px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded font-[family-name:var(--font-barlow-condensed)]"
                style={{ background: DISCIPLINE_COLOR[available[0].code] ?? "#C20000", color: "#fff" }}
              >
                {available[0].code}
              </span>
            ) : (
              <DisciplineSelector options={available} value={disc} onChange={selectDiscipline} locale={locale} />
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-2)] p-0.5 border border-[var(--border)] shrink-0">
            {(["forma", "nastup"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setHoverIdx(null); setTooltipPos(null); }}
                className="px-2.5 py-0.5 rounded text-xs font-semibold transition-colors font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide"
                style={mode === m
                  ? { background: "var(--bg)", color: "var(--ink)", boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }
                  : { background: "transparent", color: "var(--muted)" }
                }
              >
                {m === "forma" ? <FormaScoreMark size="sm" /> : locale === "en" ? "Results" : "Nastupi"}
              </button>
            ))}
          </div>

          {forma && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <span
                title={forma.lowConfidence ? t.lowConfidence : undefined}
                style={{
                  color: forma.lowConfidence ? "var(--muted)" : color,
                  fontFamily: "var(--font-jetbrains-mono,monospace)",
                  fontWeight: 800, fontSize: "1.375rem", lineHeight: 1,
                }}
              >
                {forma.score.toFixed(1)}
              </span>
              <span
                title={forma.lowConfidence ? t.lowConfidence : t.reliability}
                style={{ color: "var(--subtle)", fontFamily: "var(--font-jetbrains-mono,monospace)", fontWeight: 600, fontSize: "0.8125rem", lineHeight: 1 }}
              >
                {forma.lowConfidence ? "±?" : forma.reliability > 0 ? `±${forma.reliability.toFixed(1)}` : ""}
              </span>
              {!forma.lowConfidence && (
                <span className="flex h-[0.8125rem] items-center" style={{ color: forma_trend_color }}>
                  <TrendArrow trend={forma.trend} />
                </span>
              )}
              {forma.lowConfidence && (
                <span
                  title={t.lowConfidence}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide"
                  style={{ background: "var(--surface-2)", color: "var(--muted)" }}
                >
                  {t.lowConfidenceBadge}
                </span>
              )}
            </div>
          )}
        </div>

        {mode === "nastup" && (
          <p className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
            {t.actualPerformances}
          </p>
        )}

        {/* SVG chart */}
        <div ref={containerRef} className="select-none" style={{ cursor: isAnimating ? "default" : "crosshair" }}>
          {svgW > 0 && built && (
            <svg
              width={W}
              height={H}
              style={{ display: "block" }}
              onMouseMove={!isAnimating ? handleMouseMove : undefined}
              onMouseLeave={() => { setHoverIdx(null); setTooltipPos(null); }}
            >
              <defs>
                <clipPath id={`chart-clip-${disc}`}>
                  <rect x={ML} y={0} width={CW} height={H} />
                </clipPath>
              </defs>

              {/* Static Y axis labels — outside clip, based on current window */}
              {built.yTicks.map(y => (
                <g key={y}>
                  <line x1={ML} y1={built.sy(y).toFixed(1)} x2={W - MR} y2={built.sy(y).toFixed(1)} stroke="var(--border)" strokeWidth="1" />
                  <text x={ML - 6} y={built.sy(y).toFixed(1)} textAnchor="end" dominantBaseline="middle" fill="var(--muted)" fontSize="11" fontFamily="var(--font-jetbrains-mono,monospace)">{y}</text>
                </g>
              ))}

              <g clipPath={`url(#chart-clip-${disc})`}>
                {/* Exiting previous window */}
                {prevSlice && prevBuilt && (
                  <ChartLayer
                    key="prev"
                    data={prevSlice.data}
                    built={prevBuilt}
                    chartWidth={CW}
                    color={color}
                    locale={locale}
                    showLabels={false}
                    hoverIdx={null}
                    xInitial={0}
                    xAnimate={prevSlice.xExit}
                    onAnimationComplete={() => setPrevSlice(null)}
                  />
                )}

                {/* Entering new window */}
                <ChartLayer
                  key={`${windowStart}-${windowEnd}`}
                  data={data}
                  built={built}
                  chartWidth={CW}
                  color={color}
                  locale={locale}
                  showLabels={!isAnimating}
                  hoverIdx={isAnimating ? null : hoverIdx}
                  onHover={isAnimating ? undefined : setHoverIdx}
                  xInitial={xEnter}
                  xAnimate={0}
                />
              </g>
            </svg>
          )}
        </div>

        {/* Metric strip */}
        {forma && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 px-3 py-2.5 text-[0.8125rem] border-t border-[var(--border)] bg-[var(--surface-2)] sm:gap-x-3 sm:px-4">
              <span className="flex items-baseline gap-0.5 sm:gap-1">
                <span className="text-[var(--subtle)]">{t.level}</span>
                <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold tabular-nums text-[var(--ink)]">
                  {forma.level.toFixed(1)}
                </span>
              </span>
              {forma.peakProximity !== null && (
                <>
                  <span className="hidden text-[var(--border-strong)] min-[360px]:inline" aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 sm:gap-1.5">
                    <span className="hidden text-[var(--subtle)] min-[360px]:inline">{t.peak}</span>
                    <span className="relative h-1.5 w-10 rounded-full bg-[var(--border)] overflow-hidden sm:w-14" aria-hidden="true">
                      <span
                        className="absolute inset-y-0 left-0 right-0 rounded-full origin-left"
                        style={{ background: color, transform: `scaleX(${forma.peakProximity})`, transition: "transform 220ms cubic-bezier(0.22,1,0.36,1)" }}
                      />
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold tabular-nums text-[var(--ink)]">
                      {Math.round(forma.peakProximity * 100)}%
                    </span>
                  </span>
                </>
              )}
            <span className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[var(--ink)] font-medium">{t.consistency(forma.consistency)}</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = i < Math.round(forma.consistency * 5);
                  return (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: filled ? color : "var(--border-strong)" }}
                    />
                  );
                })}
              </span>
            </span>
            {forma.trend !== "stable" && Math.abs(forma.momentum) > 0.15 && (
              <span className="hidden text-[var(--subtle)] italic min-[400px]:inline">
                {(forma.momentum > 0) === (forma.trend === "up") ? t.momentumUp : t.momentumDown}
              </span>
            )}
          </div>
        )}

        {/* Time navigation */}
        {allData.length > WINDOW && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] bg-[var(--surface)]">
            <button
              onClick={() => navigate("right")}
              disabled={!canGoBack || isAnimating}
              className="min-h-11 px-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← {locale === "en" ? "Older" : "Starije"}
            </button>
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--subtle)", fontSize: "0.75rem", fontFamily: "var(--font-jetbrains-mono,monospace)", fontWeight: 600 }}>
                {windowStart + 1}–{windowEnd} / {allData.length}
              </span>
              {canGoForward && (
                <button
                  onClick={() => {
                    if (isAnimating) return;
                    const snapStart = Math.max(0, windowEnd - WINDOW);
                    const currentData = allData.slice(snapStart, windowEnd);
                    const currentYValues = allDisplayValues.slice(snapStart, windowEnd);
                    setPrevSlice({ data: currentData, yValues: currentYValues, xExit: -CW });
                    setNavDir("left");
                    setHoverIdx(null);
                    setTooltipPos(null);
                    setWindowOffset(0);
                  }}
                  disabled={isAnimating}
                  className="text-[0.7rem] font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1.5 py-0.5 rounded bg-[var(--border)] hover:bg-[var(--border-strong)]"
                >
                  {locale === "en" ? "Latest" : "Najnovije"}
                </button>
              )}
            </div>
            <button
              onClick={() => navigate("left")}
              disabled={!canGoForward || isAnimating}
              className="min-h-11 px-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {locale === "en" ? "Newer" : "Novije"} →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
