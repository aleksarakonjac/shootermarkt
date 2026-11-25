import type { ElimDetail, QualDetail, FinalDetail } from "@shootermarkt/db/schema";
import { isThreePositionCode } from "@shootermarkt/db/pdf-import-types";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { normalizeFinalDetailsForDisplay } from "@/lib/final-detail";
import { SeriesBox } from "./CompetitionQualTable";
import { finalCellsFor, localizeSeriesLabel, shortSeriesLabel } from "./CompetitionFinalTable";

const MEDAL_COLOR: Record<number, string> = {
  1: "oklch(0.75 0.14 85)",
  2: "oklch(0.75 0.01 85)",
  3: "oklch(0.60 0.10 55)",
};

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

/** Ravan niz vrednosti finala: zbirovi prve faze, pa pojedinačni hici eliminacione faze. */
export function finalSeriesValues(d: FinalDetail): number[] | null {
  let out: number[];
  if (d.format === "bulletin") out = d.shots?.length ? d.shots : d.series?.length ? d.series : d.cumulative ?? [];
  else if (d.format === "ar_ap_10m") out = [...d.phase1.series.map(sum), ...d.phase2.shots];
  else {
    const { kneeling, prone, standing } = d.phase1;
    out = [kneeling.total, prone.total, sum(standing.series1), sum(standing.series2), ...d.phase2.shots];
  }
  return out.length ? out : null;
}

/** Pojedinačne vrednosti finala + kumulativni zbir posle svake (iz biltena, ili tekući zbir). */
export function finalSeriesRows(d: FinalDetail): { values: number[]; cumulative: number[] } | null {
  const round = (n: number) => Math.round(n * 10) / 10;
  if (d.format === "bulletin" && !d.shots?.length && !d.series?.length && d.cumulative?.length) {
    return { values: d.cumulative.map((c, i) => round(c - (d.cumulative![i - 1] ?? 0))), cumulative: [...d.cumulative] };
  }
  const values = finalSeriesValues(d);
  if (!values) return null;
  let run = 0;
  return { values, cumulative: values.map((v) => (run = round(run + v))) };
}

interface Props {
  qualDetail: QualDetail | null;
  elimDetail: ElimDetail | null;
  elimTotal: number | null;
  elimRank: number | null;
  qualRank: number | null;
  qualScore: string | null;
  disciplineCode: string;
  locale: string;
  finalDetail: FinalDetail | null;
  finalScore: string | null;
  finalRank: number | null;
  hasDecimals?: boolean;
  inners?: number | null;
  eliminationHref?: string;
  qualificationHref?: string;
  finalHref?: string;
}

const MONO = "font-[family-name:var(--font-jetbrains-mono)]";
/** Ista tipografija oznaka kao u proširenim redovima na stranici takmičenja. */
const CHIP_LABEL = "truncate whitespace-nowrap text-center text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--subtle)]";
const POSITIONS = { sr: ["Klečeći", "Ležeći", "Stojeći"], en: ["Kneeling", "Prone", "Standing"] } as const;

/** Kartice normalne širine (ne razvlače se preko reda): telefon do 3.5rem (smanje se samo kad 6 ne staje), desktop 4.5rem. */
function chipGridStyle(cols: number): CSSProperties {
  return { "--cols": cols } as CSSProperties;
}
const CHIP_GRID = "grid gap-x-1.5 gap-y-1 grid-cols-[repeat(var(--cols),minmax(0,3.5rem))] sm:grid-cols-[repeat(var(--cols),4.5rem)]";

type Group = { label: string; values: (number | null)[]; total?: number };

/** Serije u karticama; grupe (stavovi) dobijaju naziv iznad svojih kartica. Sve najbolje serije su istaknute. */
export function SeriesChips({ groups, fmt, bestPerGroup = false }: { groups: Group[]; fmt: (v: number) => string; bestPerGroup?: boolean }) {
  const all = groups.flatMap((g) => g.values).filter((v): v is number => v != null);
  const best = (g: Group) => {
    const vals = (bestPerGroup ? g.values : all).filter((v): v is number => v != null);
    return vals.length ? Math.max(...vals) : null;
  };
  const total = groups.reduce((n, g) => n + g.values.length, 0);
  const box = (v: number | null, b: number | null, key: string) => <SeriesBox key={key} text={v != null ? fmt(v) : "—"} best={v != null && v === b} onSurface />;
  const labelled = groups.some((g) => g.label);
  // Sve grupe u jednom redu dok staju (trostav 3×20 = 6), inače svaka grupa u svom redu.
  if (!labelled || total <= 8) {
    const cols = Math.min(total, 6) === total ? total : 6;
    return (
      <div className={CHIP_GRID} style={chipGridStyle(labelled ? total : cols)}>
        {labelled && groups.map((g, gi) => (
          <span key={`l${gi}`} className={CHIP_LABEL} style={{ gridColumn: `span ${g.values.length}` }}>
            {g.label}{g.total != null && <span className={`ml-1 normal-case tracking-normal text-[var(--muted)] ${MONO}`}>{fmt(g.total)}</span>}
          </span>
        ))}
        {groups.flatMap((g, gi) => g.values.map((v, vi) => box(v, best(g), `${gi}-${vi}`)))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          <span className={`${CHIP_LABEL} text-left`}>
            {g.label}{g.total != null && <span className={`ml-1.5 normal-case tracking-normal text-[var(--muted)] ${MONO}`}>{fmt(g.total)}</span>}
          </span>
          <div className={CHIP_GRID} style={chipGridStyle(Math.min(g.values.length, 6))}>
            {g.values.map((v, vi) => box(v, best(g), `${vi}`))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ravne serije → grupe: trostav deljiv na 3 stava dobija nazive stavova, ostalo jedna grupa bez naziva. */
function flatGroups(series: number[], threePosition: boolean, locale: string): Group[] {
  const labels = locale === "en" ? POSITIONS.en : POSITIONS.sr;
  if (threePosition && series.length >= 3 && series.length % 3 === 0) {
    const n = series.length / 3;
    return labels.map((label, i) => ({ label, values: series.slice(i * n, i * n + n) }));
  }
  return [{ label: "", values: series }];
}

function PhaseHeader({ label, rank, href, hrefLabel, score, extra }: { label: string; rank?: ReactNode; href?: string; hrefLabel: string; score: ReactNode; extra?: ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center justify-between gap-3 text-xs sm:justify-start sm:text-sm font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)]">
      <span className="flex items-center gap-1">
        {label}{rank}
        {href && <Link href={href} aria-label={hrefLabel} className="inline-flex size-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"><ArrowUpRight size={14} /></Link>}
      </span>
      <span className={`${MONO} text-sm font-bold normal-case tabular-nums text-[var(--ink)]`}>{score}{extra}</span>
    </p>
  );
}

export function ResultDetailPanel({
  qualDetail,
  elimDetail,
  elimTotal,
  elimRank,
  qualRank,
  qualScore,
  disciplineCode,
  locale,
  finalDetail,
  finalScore,
  finalRank,
  hasDecimals,
  inners,
  eliminationHref,
  qualificationHref,
  finalHref,
}: Props) {
  const en = locale === "en";
  // Stara finala (samo zbirovi) dobijaju iste oznake kao na stranici takmičenja (Klečeći/Ležeći…, S1, 11–12…).
  const displayFinal = finalDetail ? normalizeFinalDetailsForDisplay(disciplineCode, [finalDetail])[0] as FinalDetail : null;
  const finalCells = displayFinal ? finalCellsFor(displayFinal, disciplineCode) : [];
  const threePosition = isThreePositionCode(disciplineCode);
  const fmt = (v: number) => (hasDecimals ? v.toFixed(1) : Math.round(v).toString());

  if (!elimDetail && elimTotal == null && !qualDetail && finalCells.length === 0) {
    return (
      <div className="bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3">
        <p className="text-xs italic text-[var(--subtle)]">{en ? "No series details." : "Nema detalja serija."}</p>
      </div>
    );
  }

  const qualGroups: Group[] | null = !qualDetail
    ? null
    : "series" in qualDetail
      ? flatGroups(qualDetail.series, threePosition, locale)
      : "kneeling" in qualDetail
        ? (["kneeling", "prone", "standing"] as const).map((pos, i) => ({
            label: (en ? POSITIONS.en : POSITIONS.sr)[i],
            // Zaokruženo na 0.1 da float greška zbira ne razbije jednakost serija.
            values: qualDetail[pos].series.map((shots) => Math.round(shots.reduce((a, b) => a + b, 0) * 10) / 10),
            total: qualDetail[pos].total,
          }))
        : null;
  const medal = finalRank != null && (MEDAL_COLOR[finalRank]
    ? <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full text-[0.55rem] font-bold text-white" style={{ background: MEDAL_COLOR[finalRank] }} aria-label={`${en ? "Place" : "Mesto"} ${finalRank}`}>{finalRank}</span>
    : <span className={`ml-1 ${MONO} text-[0.65rem] text-[var(--subtle)]`}>#{finalRank}</span>);

  return (
    <div className="space-y-3 border-t border-[var(--border)] bg-[var(--surface)] px-3 pb-3 pt-2 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-10 sm:gap-y-3">
        {(elimDetail || elimTotal != null) && (
          <div>
            <PhaseHeader label={en ? "Eliminations" : "Eliminacije"} rank={elimRank != null ? ` · #${elimRank}` : ""} href={eliminationHref} hrefLabel={en ? "Open elimination results" : "Otvori rezultate eliminacija"} score={elimTotal ?? ""} extra={elimDetail?.inners != null ? ` ${elimDetail.inners}×` : ""} />
            {elimDetail && <SeriesChips groups={flatGroups(elimDetail.series, threePosition, locale)} fmt={fmt} />}
          </div>
        )}
        {qualDetail && (
          <div>
            <PhaseHeader label={en ? "Qualification" : "Kvalifikacije"} rank={qualRank != null ? ` · #${qualRank}` : ""} href={qualificationHref} hrefLabel={en ? "Open qualification results" : "Otvori rezultate kvalifikacija"} score={qualScore} extra={inners != null ? ` ${inners}×` : ""} />
            {qualGroups && <SeriesChips groups={qualGroups} fmt={fmt} bestPerGroup={"kneeling" in qualDetail} />}
          </div>
        )}
      </div>

      {finalCells.length > 0 && (
        // Vazdušna puška: kvalifikacija i finale su kratki, bez linije između (kao ranije).
        <div className={(qualDetail || elimDetail) && disciplineCode !== "ARM" && disciplineCode !== "ARW" ? "border-t border-[var(--border)] pt-3" : ""}>
          <PhaseHeader label={en ? "Final" : "Finale"} rank={medal || null} href={finalHref} hrefLabel={en ? "Open final results" : "Otvori rezultate finala"} score={finalScore} />
          {/* Kao tabela finala na stranici takmičenja: oznaka iznad, vrednost serije, ispod kumulativ. */}
          <div className="grid grid-cols-[repeat(auto-fill,3.5rem)] gap-x-1.5 gap-y-2 sm:grid-cols-[repeat(auto-fill,4.5rem)]">
            {finalCells.map((cell, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-1">
                <span title={localizeSeriesLabel(cell.header, locale)} className={CHIP_LABEL}>
                  <span className="sm:hidden">{shortSeriesLabel(cell.header, locale)}</span>
                  <span className="max-sm:hidden">{localizeSeriesLabel(cell.header, locale)}</span>
                </span>
                <div className="flex min-w-0 flex-col items-center rounded-md bg-[var(--bg)] px-1 py-1.5 ring-1 ring-[var(--border)]">
                  <span className={`${MONO} text-sm font-semibold tabular-nums text-[var(--ink)]`}>{cell.main}</span>
                  <span className={`${MONO} text-[0.7rem] tabular-nums text-[var(--subtle)]`}>{cell.sub || " "}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
