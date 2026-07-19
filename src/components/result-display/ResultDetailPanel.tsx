import type { QualDetail, FinalDetail } from "@/lib/db/schema";
import { SeriesQualDisplay } from "./SeriesQualDisplay";
import { PositionsQualDisplay } from "./PositionsQualDisplay";
import { ArApFinalDisplay } from "./ArApFinalDisplay";
import { BulletinFinalDisplay } from "./BulletinFinalDisplay";
import { PositionsFinalDisplay } from "./PositionsFinalDisplay";

interface Props {
  qualDetail: QualDetail | null;
  finalDetail: FinalDetail | null;
  finalRanks?: Array<number | null> | null;
  hasDecimals?: boolean;
  inners?: number | null;
}

export function ResultDetailPanel({
  qualDetail,
  finalDetail,
  finalRanks,
  hasDecimals,
  inners,
}: Props) {
  if (!qualDetail && !finalDetail) {
    return (
      <div className="bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3">
        <p className="text-xs italic text-[var(--subtle)]">
          Nema detalja serija.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border-t border-[var(--border)] px-4 py-4 space-y-5">
      {/* Qualification breakdown */}
      {qualDetail && (
        <div>
          <p className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)] mb-2">
            Kvalifikacija — Serije
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

      {/* Final breakdown */}
      {finalDetail && (
        <div
          className={
            qualDetail ? "border-t border-[var(--border)] pt-4" : ""
          }
        >
          <p className="text-[0.65rem] font-semibold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[var(--muted)] mb-2">
            Finale
          </p>
          {finalDetail.format === "ar_ap_10m" ? (
            <ArApFinalDisplay detail={finalDetail} />
          ) : finalDetail.format === "bulletin" ? (
            <BulletinFinalDisplay detail={finalDetail} ranks={finalRanks} />
          ) : (
            <PositionsFinalDisplay detail={finalDetail} />
          )}
        </div>
      )}
    </div>
  );
}
