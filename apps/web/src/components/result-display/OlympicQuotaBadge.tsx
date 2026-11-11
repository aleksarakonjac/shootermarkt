"use client";

import { useState } from "react";
import { useUiLocale } from "@/hooks/use-ui-locale";
import { RemarkModal } from "./RemarkBadge";

// Olimpijski krugovi u originalnim bojama; crni krug prati boju teksta da ostane vidljiv u tamnoj temi.
// Zamena simbola (ako IOC zatraži) je jedino ovde.
const RINGS: Array<{ cx: number; cy: number; color: string }> = [
  { cx: 10, cy: 10, color: "#0085C7" },
  { cx: 30, cy: 10, color: "var(--ink)" },
  { cx: 50, cy: 10, color: "#DF0024" },
  { cx: 20, cy: 20, color: "#F4C300" },
  { cx: 40, cy: 20, color: "#009F3D" },
];

export function OlympicRings({ height = 14 }: { height?: number }) {
  return (
    <svg width={(height * 60) / 30} height={height} viewBox="0 0 60 30" fill="none" aria-hidden="true" className="shrink-0">
      {RINGS.map((r) => (
        <circle key={r.color} cx={r.cx} cy={r.cy} r={8.2} stroke={r.color} strokeWidth={2.6} />
      ))}
    </svg>
  );
}

/** Oznaka pored strelca koji je u finalu osvojio olimpijsku kvotu; klik otvara objašnjenje. */
export function OlympicQuotaBadge({ name, noc, disciplineCode }: { name: string; noc: string | null; disciplineCode?: string }) {
  const [open, setOpen] = useState(false);
  const en = useUiLocale() === "en";
  const detail = [noc, disciplineCode].filter(Boolean).join(", ");
  const title = en ? "Olympic quota place won for LA 2028" : "Osvojena olimpijska kvota za LA 2028";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-haspopup="dialog"
        aria-label={title}
        title={title}
        // 44px zona dodira bez povećanja reda: negativne margine kompenzuju visinu.
        className="ml-1.5 -my-2 -mx-1 inline-flex h-11 min-w-9 shrink-0 items-center justify-center rounded-md px-1 hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)]"
      >
        <OlympicRings />
      </button>
      {open && (
        <RemarkModal label={en ? "Olympic quota" : "Olimpijska kvota"} onClose={() => setOpen(false)}>
          <div className="flex items-center gap-2.5 mb-2">
            <OlympicRings height={18} />
            <p className="text-base font-semibold text-[var(--ink)]">{en ? "Quota place won for LA 2028" : "Osvojena kvota za LA 2028"}</p>
          </div>
          <p className="text-sm text-[var(--ink)]">
            {en ? "Won by the performance of " : "Osvojena nastupom: "}
            <span className="font-semibold">{name}</span>
            {detail && <span className="text-[var(--muted)]"> ({detail})</span>}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {en ? "The quota place formally belongs to the National Olympic Committee, not to the shooter." : "Kvota formalno pripada nacionalnom olimpijskom komitetu (NOC), ne strelcu."}
          </p>
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--subtle)]">
            {en ? "Unofficial marking. This site is not affiliated with the IOC or the Olympic Committee of Serbia." : "Nezvanična oznaka. Sajt nije povezan sa IOC-om ni sa Olimpijskim komitetom Srbije."}
          </p>
        </RemarkModal>
      )}
    </>
  );
}
