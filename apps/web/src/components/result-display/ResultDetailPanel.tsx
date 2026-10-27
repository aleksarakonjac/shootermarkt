import type { ElimDetail, QualDetail, FinalDetail } from "@shootermarkt/db/schema";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { SeriesQualDisplay } from "./SeriesQualDisplay";
import { PositionsQualDisplay } from "./PositionsQualDisplay";

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
  const finalSeries = finalDetail ? finalSeriesValues(finalDetail) : null;
  const qualSeries = qualDetail && "series" in qualDetail ? qualDetail.series : null;
  const sharedSeriesCount = elimDetail && qualSeries ? Math.max(elimDetail.series.length, qualSeries.length) : undefined;
  const r3pGroupLabels = disciplineCode.startsWith("R3P") && (sharedSeriesCount ?? qualSeries?.length ?? elimDetail?.series.length) === 6
    ? (locale === "en" ? ["Kneeling", "Prone", "Standing"] : ["Klečeći", "Ležeći", "Stojeći"])
    : undefined;
  const isAirRifle = disciplineCode === "ARM" || disciplineCode === "ARW";

  if (!elimDetail && elimTotal == null && !qualDetail && !finalSeries) {
    return (
      <div className="bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3">
        <p className="text-xs italic text-[var(--subtle)]">
          {locale === "en" ? "No series details." : "Nema detalja serija."}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-[var(--surface)] border-t border-[var(--border)] px-3 pb-3 pt-2 ${isAirRifle ? "space-y-1.5" : "space-y-3"} sm:px-4 sm:pb-2.5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-12 sm:gap-y-3">
      {elimDetail && (
        <div className={qualDetail ? "-mb-2 sm:mb-0" : ""}>
          <p className="mb-1.5 flex items-center justify-between gap-3 text-xs sm:justify-start sm:text-sm font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)]">
            <span className="flex items-center gap-1">{locale === "en" ? "Eliminations" : "Eliminacije"}{elimRank != null ? ` · #${elimRank}` : ""}{eliminationHref && <Link href={eliminationHref} aria-label={locale === "en" ? "Open elimination results" : "Otvori rezultate eliminacija"} className="inline-flex size-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"><ArrowUpRight size={14} /></Link>}</span><span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold normal-case tabular-nums text-[var(--ink)]">{elimTotal}{elimDetail.inners != null ? ` ${elimDetail.inners}×` : ""}</span>
          </p>
          <SeriesQualDisplay detail={elimDetail} columnCount={sharedSeriesCount} groupLabels={r3pGroupLabels} showTotal={false} />
        </div>
      )}
      {!elimDetail && elimTotal != null && (
        <div className="flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tabular-nums text-[var(--ink)]">
          <span>{locale === "en" ? "Eliminations" : "Eliminacije"} · {elimTotal}{elimRank != null ? ` · #${elimRank}` : ""}</span>{eliminationHref && <Link href={eliminationHref} aria-label={locale === "en" ? "Open elimination results" : "Otvori rezultate eliminacija"} className="inline-flex size-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"><ArrowUpRight size={14} /></Link>}
        </div>
      )}

      {/* Qualification breakdown */}
      {qualDetail && (
        <div className={elimDetail ? "pt-[14px] sm:pt-0" : ""}>
          <p className="mb-1.5 flex items-center justify-between gap-3 text-xs sm:justify-start sm:text-sm font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)]">
            <span className="flex items-center gap-1">{locale === "en" ? "Qualification" : "Kvalifikacije"}{qualRank != null ? ` · #${qualRank}` : ""}{qualificationHref && <Link href={qualificationHref} aria-label={locale === "en" ? "Open qualification results" : "Otvori rezultate kvalifikacija"} className="inline-flex size-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"><ArrowUpRight size={14} /></Link>}</span><span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold normal-case tabular-nums text-[var(--ink)]">{qualScore}{inners != null ? ` ${inners}×` : ""}</span>
          </p>
          {"series" in qualDetail ? (
            <SeriesQualDisplay
              detail={qualDetail}
              hasDecimals={hasDecimals}
              inners={inners}
              columnCount={sharedSeriesCount}
              groupLabels={r3pGroupLabels}
              showTotal={false}
            />
          ) : (
            <PositionsQualDisplay
              detail={qualDetail}
              hasDecimals={hasDecimals}
              locale={locale}
              showGrandTotal={false}
            />
          )}
        </div>
      )}

      </div>

      {finalSeries && (
        <div className={qualDetail && !isAirRifle ? "border-t border-[var(--border)] pt-4" : ""}>
          <p className="mb-1.5 flex items-center justify-between gap-3 text-xs sm:justify-start sm:text-sm font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)]">
            <span className="flex items-center gap-1">{locale === "en" ? "Final" : "Finale"}{finalRank != null && (MEDAL_COLOR[finalRank] ? <span className="inline-flex size-4 items-center justify-center rounded-full text-[0.55rem] font-bold text-white" style={{ background: MEDAL_COLOR[finalRank] }} aria-label={`${locale === "en" ? "Place" : "Mesto"} ${finalRank}`}>{finalRank}</span> : <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)]">#{finalRank}</span>)}{finalHref && <Link href={finalHref} aria-label={locale === "en" ? "Open final results" : "Otvori rezultate finala"} className="inline-flex size-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"><ArrowUpRight size={14} /></Link>}</span><span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold normal-case tabular-nums text-[var(--ink)]">{finalScore}</span>
          </p>
          <div className="flex flex-nowrap items-center overflow-x-auto font-[family-name:var(--font-jetbrains-mono)] text-[0.7rem] tabular-nums text-[var(--muted)] sm:text-xs">
            {finalSeries.map((value, index) => <span key={index} className={`shrink-0 px-[5px] ${index === 0 ? "pl-0" : ""} ${index < finalSeries.length - 1 ? "border-r border-[var(--border)]" : ""} sm:px-2`}>{finalDetail?.format === "bulletin" && finalDetail.scoring === "hit_count" ? Math.round(value) : value.toFixed(1)}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
