"use client";

import { useState } from "react";
import { useUiLocale } from "@/hooks/use-ui-locale";
import { NOC_LIST } from "@shootermarkt/db/noc-list";
import { RemarkModal } from "./RemarkBadge";

/** Naziv države na jeziku sajta (Intl iz alpha-2 koda). Neutralni sportisti (AIN) i šifre bez države ostaju kod NOC-a. */
function countryName(noc: string | null, en: boolean): string | null {
  const entry = NOC_LIST.find((n) => n.noc === noc);
  if (!entry || noc === "AIN") return noc;
  try {
    return new Intl.DisplayNames([en ? "en" : "sr-Latn"], { type: "region" }).of(entry.alpha2) ?? noc;
  } catch {
    return noc;
  }
}

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

type QuotaProps = { name: string; noc: string | null; disciplineCode?: string };

/** Objašnjenje osvojene kvote: isti tekst u modalu na klik i u detaljima rezultata (mobilni sheet / desktop panel). */
function QuotaMessage({ name, noc, disciplineCode }: QuotaProps) {
  const en = useUiLocale() === "en";
  const country = countryName(noc, en);
  return (
    <>
      <div className="flex items-center gap-2.5 mb-2">
        <OlympicRings height={18} />
        <p className="text-base font-semibold text-[var(--ink)]">{en ? "Quota place won for LA 2028" : "Osvojena kvota za LA 2028"}</p>
      </div>
      <p className="text-sm text-[var(--ink)]">
        {country && (en ? `Quota for ${country} won by ` : `Kvota države ${country} osvojena: `)}
        <span className="font-semibold">{name}</span>
        {disciplineCode && <span className="text-[var(--muted)]"> ({disciplineCode})</span>}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {en ? "The quota place formally belongs to the National Olympic Committee." : "Kvota formalno pripada nacionalnom olimpijskom komitetu (NOC)."}
      </p>
      <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--subtle)]">
        {en ? "Unofficial marking. This site is not affiliated with the IOC." : "Nezvanična oznaka. Sajt nije povezan sa IOC-om."}
      </p>
    </>
  );
}

/** Blok sa objašnjenjem u detaljima rezultata strelca koji je osvojio kvotu. */
export function OlympicQuotaNote(props: QuotaProps) {
  return (
    <div className="mt-4 rounded-lg bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
      <QuotaMessage {...props} />
    </div>
  );
}

/** Oznaka pored strelca koji je osvojio olimpijsku kvotu; klik otvara objašnjenje. */
export function OlympicQuotaBadge(props: QuotaProps) {
  const [open, setOpen] = useState(false);
  const en = useUiLocale() === "en";
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
        // Modal je portal, ali React događaji i dalje idu kroz stablo komponenti: bez ovoga klik na "✕" ili pozadinu
        // stiže do klika reda tabele i otvara/zatvara red.
        <span onClick={(e) => e.stopPropagation()}>
          <RemarkModal label={en ? "Olympic quota" : "Olimpijska kvota"} onClose={() => setOpen(false)}>
            <QuotaMessage {...props} />
          </RemarkModal>
        </span>
      )}
    </>
  );
}
