import type { QualDetail, FinalDetail } from "@shootermarkt/db/schema";
import { SeriesQualDisplay } from "./SeriesQualDisplay";
import { PositionsQualDisplay } from "./PositionsQualDisplay";

interface Props {
  qualDetail: QualDetail | null;
  finalDetail: FinalDetail | null;
  finalScore: string | null;
  hasDecimals?: boolean;
  inners?: number | null;
}

export function ResultDetailPanel({
  qualDetail,
  finalDetail,
  finalScore,
  hasDecimals,
  inners,
}: Props) {
  const finalSeries = finalDetail?.format === "bulletin" && finalDetail.series?.length
    ? finalDetail.series
    : null;

  if (!qualDetail && !finalSeries) {
    return (
      <div className="bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3">
        <p className="text-xs italic text-[var(--subtle)]">
          Nema detalja serija.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border-t border-[var(--border)] px-3 py-4 space-y-5 sm:px-4">
      {/* Qualification breakdown */}
      {qualDetail && (
        <div>
          <p className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)] mb-2">
            Kvalifikacije
          </p>
          {"series" in qualDetail ? (
            <SeriesQualDisplay
              detail={qualDetail}
              hasDecimals={hasDecimals}
              inners={inners}
            />
          ) : (
            <PositionsQualDisplay
              detail={qualDetail}
              hasDecimals={hasDecimals}
            />
          )}
        </div>
      )}

      {finalSeries && (
        <div className={qualDetail ? "border-t border-[var(--border)] pt-4" : ""}>
          <p className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)] mb-2">
            Finale
          </p>
          <div className="flex flex-nowrap items-center font-[family-name:var(--font-jetbrains-mono)] text-[0.7rem] tabular-nums text-[var(--muted)] sm:text-xs">
            {finalSeries.map((value, index) => <span key={index} className={`px-[5px] ${index === 0 ? "pl-0" : ""} ${index < finalSeries.length - 1 ? "border-r border-[var(--border)]" : ""} sm:px-2`}>{finalDetail?.format === "bulletin" && finalDetail.scoring !== "hit_count" ? value.toFixed(1) : Math.round(value)}</span>)}
            {finalScore != null && <span className="ml-[5px] font-bold text-[var(--ink)] sm:ml-2">{finalScore}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
