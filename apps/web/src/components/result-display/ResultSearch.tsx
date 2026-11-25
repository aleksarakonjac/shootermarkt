"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { NOC_LIST, displayNoc } from "@shootermarkt/db/noc-list";
import { countryKeywords, foldSearch } from "@/lib/country-search";

/** Termini za državu: NOC (i AIN za neutralne), srpski naziv iz liste, sr/en naziv iz Intl. */
export function nocKeywords(noc: string | null | undefined): string {
  if (!noc) return "";
  const shown = displayNoc(noc);
  const entry = NOC_LIST.find((n) => n.noc === shown);
  return countryKeywords(entry?.alpha2, noc, shown, entry?.name);
}

/** Svaka reč upita mora da se nađe u nekom od delova (bez obzira na redosled, velika slova i dijakritike). */
export function matchesSearch(query: string, ...parts: (string | null | undefined)[]): boolean {
  const tokens = foldSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = foldSearch(parts.filter(Boolean).join(" "));
  return tokens.every((t) => hay.includes(t));
}

/** Slot pored naslova "Rezultati" (stranica takmičenja) — na telefonu pretraga ide tamo. */
const MOBILE_SLOT_ID = "results-search-slot";

function SearchInput({ value, onChange, en, className }: { value: string; onChange: (v: string) => void; en: boolean; className: string }) {
  const label = en ? "Search shooter or nation" : "Pretraži strelca ili naciju";
  return (
    <label className={`relative ${className}`}>
      <span className="sr-only">{label}</span>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onChange(""); }}
        placeholder={en ? "Shooter or nation" : "Strelac ili nacija"}
        className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] py-0 pl-8 pr-8 text-base text-[var(--ink)] placeholder:text-[var(--subtle)] focus:border-[var(--border-strong)] focus:outline-none sm:text-xs [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label={en ? "Clear search" : "Obriši pretragu"} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--ink)]">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

/** Pretraga strelca/nacije za kvalifikacije, eliminacije i miks (finale je kratko, nema je). Desktop: desno od selektora faze; telefon: desno od naslova "Rezultati". */
export function ResultSearch({ value, onChange, en, count, total, className = "mb-3" }: { value: string; onChange: (v: string) => void; en: boolean; count: number; total: number; className?: string }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById(MOBILE_SLOT_ID)), []);
  const counter = value.trim() ? <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{count}/{total}</span> : null;
  return (
    <>
      <div className={`${className} items-center gap-3 ${slot ? "hidden sm:flex" : "flex"}`}>
        {counter}
        <SearchInput value={value} onChange={onChange} en={en} className="w-full sm:w-64" />
      </div>
      {slot && createPortal(
        <div className="flex w-full max-w-64 items-center gap-2">{counter}<SearchInput value={value} onChange={onChange} en={en} className="min-w-0 flex-1" /></div>,
        slot,
      )}
    </>
  );
}

export function NoSearchMatch({ query, en }: { query: string; en: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-12 text-center text-sm text-[var(--muted)]">
      {en ? `No results for “${query.trim()}”.` : `Nema rezultata za „${query.trim()}".`}
    </div>
  );
}
