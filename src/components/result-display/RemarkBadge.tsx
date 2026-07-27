"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Boja po značenju kazne/napomene — bez box-a, samo obojeno slovo/oznaka.
// DSQ i A-kaznene oznake (A1, A2...) su diskvalifikacije → crveno (--danger).
// RPO nije kazna niti neuspeh — strelac je punopravno odshootao, samo ne može
// u finale zbog nacionalne kvote (max 3/nacija) → posebna (amber) boja, da se
// razlikuje i od diskvalifikacije i od DNS/DNF (koji nemaju rezultat uopšte).
// --warning token je presvetao za tekst (2.5:1 na belom) pa koristimo tamniju
// nijansu istog hue-a koja prolazi AA kontrast.
export const RPO_COLOR = "oklch(0.55 0.16 75)";

export function remarkColor(remark: string): string {
  if (remark === "DSQ" || /^A\d/.test(remark)) return "var(--danger)";
  if (remark === "RPO") return RPO_COLOR;
  return "var(--muted)";
}

/** Predugi remark (npr. puna kaznena rečenica) dobija kratku "A1", "A2"...
 *  oznaku, dodeljenu redom kako se pojavljuju u tabeli. Kratki (RPO/DSQ/SO...)
 *  ostaju kakvi jesu. */
export function assignRemarkCodes(remarks: Array<string | null | undefined>): Array<string | null> {
  let n = 0;
  return remarks.map((remark) => (remark && remark.length > 3 ? `A${++n}` : null));
}

function RemarkModal({ remark, label, onClose }: { remark: string; label?: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label || "Napomena"}</p>
          <button type="button" onClick={onClose} aria-label="Zatvori" className="text-[var(--subtle)] hover:text-[var(--ink)] text-sm leading-none">✕</button>
        </div>
        <p className="text-sm text-[var(--ink)] whitespace-pre-wrap">{remark}</p>
      </div>
    </div>,
    document.body
  );
}

/** `code` (npr. "A1") se prosleđuje samo kad je remark predugačak da stane u
 *  kolonu — tad se prikazuje kao dugme koje na klik otvara modal sa punim tekstom. */
export function RemarkBadge({ remark, code, label, className = "ml-1.5" }: { remark: string; code?: string | null; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);

  if (code) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={`font-bold uppercase tracking-wide font-[family-name:var(--font-jetbrains-mono)] text-base shrink-0 leading-none underline decoration-dotted underline-offset-2 ${className}`}
          style={{ color: "var(--danger)" }}
          title="Prikaži napomenu"
        >
          {code}
        </button>
        {open && <RemarkModal remark={remark} label={label} onClose={() => setOpen(false)} />}
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
