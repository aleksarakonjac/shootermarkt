"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUiLocale } from "@/hooks/use-ui-locale";
import type { StageRemarks } from "@shootermarkt/db/pdf-import-types";

// Boja po značenju kazne/napomene — bez box-a, samo obojeno slovo/oznaka.
// DSQ i A-kaznene oznake (A1, A2...) su diskvalifikacije → crveno (--danger).
// RPO nije kazna niti neuspeh — strelac je punopravno odshootao, samo ne može
// u finale zbog nacionalne kvote (max 3/nacija) → posebna (amber) boja, da se
// razlikuje i od diskvalifikacije i od DNS/DNF (koji nemaju rezultat uopšte).
// --warning token je presvetao za tekst (2.5:1 na belom) pa koristimo tamniju
// nijansu istog hue-a koja prolazi AA kontrast.
const RPO_COLOR = "oklch(0.55 0.16 75)";

function remarkColor(remark: string): string {
  if (remark === "DSQ" || /^A\d/.test(remark)) return "var(--danger)";
  if (remark === "RPO") return RPO_COLOR;
  if (RECORDS[remark]) return "var(--success)";
  return "var(--muted)";
}

const STATUS: Record<string, [sr: string, en: string]> = {
  DSQ: ["Diskvalifikovan", "Disqualified"],
  DNS: ["Nije startovao", "Did not start"],
  DNF: ["Nije završio", "Did not finish"],
  RPO: ["Samo za bodove rang liste — ne ulazi u finale (kvota nacije)", "Ranking points only — cannot enter the final (nation quota)"],
};

// ISSF record codes: Q = qualification record, E = equalled, J = junior.
const RECORDS: Record<string, [sr: string, en: string]> = {
  WR: ["Svetski rekord", "World record"],
  EWR: ["Izjednačen svetski rekord", "Equalled world record"],
  WRJ: ["Svetski juniorski rekord", "Junior world record"],
  EWRJ: ["Izjednačen svetski juniorski rekord", "Equalled junior world record"],
  QWR: ["Svetski rekord u kvalifikacijama", "Qualification world record"],
  EQWR: ["Izjednačen svetski rekord u kvalifikacijama", "Equalled qualification world record"],
  QWRJ: ["Juniorski svetski rekord u kvalifikacijama", "Junior qualification world record"],
  EQWRJ: ["Izjednačen juniorski svetski rekord u kvalifikacijama", "Equalled junior qualification world record"],
};

const hasDetails = (d: StageRemarks | null | undefined): d is StageRemarks => !!(d?.penalty || d?.shootOff || d?.record);

/** Label for the remark column: status mark first, otherwise the record or shoot-off. */
export function remarkLabel(remark: string | null | undefined, details?: StageRemarks | null): string | null {
  return remark ?? details?.record ?? (details?.shootOff ? "SO" : null);
}

/** Predugi remark (npr. puna kaznena rečenica) dobija kratku "A1", "A2"...
 *  oznaku, dodeljenu redom kako se pojavljuju u tabeli. Kratki (RPO/DSQ/SO...)
 *  ostaju kakvi jesu. */
export function assignRemarkCodes(remarks: Array<string | null | undefined>): Array<string | null> {
  let n = 0;
  return remarks.map((remark) => (remark && remark.length > 3 ? `A${++n}` : null));
}

function RemarkModal({ label, onClose, children }: { label?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const en = useUiLocale() === "en";
  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4"
      style={{ background: "oklch(0 0 0 / 0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label || (en ? "Remark" : "Napomena")}</p>
          <button type="button" onClick={onClose} aria-label={en ? "Close" : "Zatvori"} className="text-[var(--subtle)] hover:text-[var(--ink)] text-sm leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** `code` (npr. "A1") se prosleđuje samo kad je remark predugačak da stane u
 *  kolonu — tad se prikazuje kao dugme koje na klik otvara modal sa punim tekstom. */
/** `details` (kazna / shoot-off / rekord iz SIUS-a) čini oznaku klikabilnom — modal prikazuje sve detalje. */
export function RemarkBadge({ remark, code, label, details, className = "ml-1.5" }: { remark: string; code?: string | null; label?: string; details?: StageRemarks | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const en = useUiLocale() === "en";

  if (code) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={`font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)] text-base shrink-0 leading-none underline decoration-dotted underline-offset-2 ${className}`}
          style={{ color: "var(--danger)" }}
          title={en ? "Show remark" : "Prikaži napomenu"}
        >
          {code}
        </button>
        {open && (
          <RemarkModal label={label} onClose={() => setOpen(false)}>
            <p className="text-sm text-[var(--ink)] whitespace-pre-wrap">{remark}</p>
          </RemarkModal>
        )}
      </>
    );
  }

  if (hasDetails(details)) {
    const status = STATUS[remark];
    const record = details.record ? RECORDS[details.record] : undefined;
    // The badge shows the record/"SO" itself when there is no status mark — then there is no status row.
    const isStatus = !RECORDS[remark] && remark !== "SO";
    const rows: Array<[string, string, string?]> = [
      ...(isStatus ? [[en ? "Status" : "Status", remark, status ? status[en ? 1 : 0] : undefined] as [string, string, string?]] : []),
      ...(details.penalty ? [[en ? "Penalty" : "Kazna", details.penalty] as [string, string]] : []),
      ...(details.shootOff ? [["Shoot-off", details.shootOff, details.shootOff === "SO" ? undefined : (en ? "extra shots fired to break a tie" : "dodatni hici za razrešenje nerešenog")] as [string, string, string?]] : []),
      ...(details.record ? [[en ? "Record" : "Rekord", details.record, record?.[en ? 1 : 0]] as [string, string, string?]] : []),
    ];
    return (
      <>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={`font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)] text-base shrink-0 leading-none underline decoration-dotted underline-offset-2 ${className}`}
          style={{ color: remarkColor(remark) }}
          aria-haspopup="dialog"
          title={en ? "Show details" : "Prikaži detalje"}
        >
          {remark}
        </button>
        {open && (
          <RemarkModal label={label} onClose={() => setOpen(false)}>
            <dl className="space-y-3">
              {rows.map(([term, value, note]) => (
                <div key={term}>
                  <dt className="text-xs font-semibold text-[var(--muted)]">{term}</dt>
                  <dd className="text-sm text-[var(--ink)]">
                    <span className="font-semibold font-[family-name:var(--font-jetbrains-mono)]">{value}</span>
                    {note && <span className="text-[var(--muted)]"> — {note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </RemarkModal>
        )}
      </>
    );
  }

  return (
    <span
      className={`font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)] text-base shrink-0 leading-none ${className}`}
      style={{ color: remarkColor(remark) }}
      title={remark}
    >
      {remark}
    </span>
  );
}

export type RemarkLegendItem = { code: string; remark: string; label: string };

/** Ispisuje pun tekst svakog dugog remarka (A1, A2...) ispod tabele — isti
 *  sadržaj kao modal na klik, samo bez potrebe da se otvara. */
export function RemarkLegend({ items }: { items: RemarkLegendItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 space-y-1.5 border-t border-[var(--border)] px-3 pb-3 pt-3">
      {items.map((item) => (
        <p key={item.code} className="text-xs text-[var(--muted)]">
          <span
            className="mr-1.5 font-bold font-[family-name:var(--font-jetbrains-mono)]"
            style={{ color: "var(--danger)" }}
          >
            {item.code}
          </span>
          — {item.remark}
          {item.label && <span className="text-[var(--subtle)]"> ({item.label})</span>}
        </p>
      ))}
    </div>
  );
}
