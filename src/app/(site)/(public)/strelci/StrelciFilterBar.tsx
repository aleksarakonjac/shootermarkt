"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { NOC_LIST } from "@/components/ui/NocDropdown";

interface Props {
  availableNocs: string[];
  currentQ: string;
  currentZemlja: string;
  currentPol: string;
  totalCount: number;
  shownCount: number;
  page: number;
  totalPages: number;
}

const GENDER_OPTIONS = [
  ["", "Svi"],
  ["M", "Muški"],
  ["F", "Ženski"],
] as const;

export function StrelciFilterBar({
  availableNocs,
  currentQ,
  currentZemlja,
  currentPol,
  totalCount,
  shownCount,
  page,
  totalPages,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(currentQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function buildUrl(overrides: { q?: string; zemlja?: string; pol?: string; page?: number }) {
    const vals = {
      q:      overrides.q      !== undefined ? overrides.q      : q,
      zemlja: overrides.zemlja !== undefined ? overrides.zemlja : currentZemlja,
      pol:    overrides.pol    !== undefined ? overrides.pol    : currentPol,
      page:   overrides.page   !== undefined ? overrides.page   : undefined,
    };
    const p = new URLSearchParams();
    if (vals.q)      p.set("q", vals.q);
    if (vals.zemlja) p.set("zemlja", vals.zemlja);
    if (vals.pol)    p.set("pol", vals.pol);
    if (vals.page && vals.page > 1) p.set("page", String(vals.page));
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function push(overrides: { q?: string; zemlja?: string; pol?: string; page?: number }) {
    router.replace(buildUrl(overrides));
  }

  useEffect(() => {
    if (q === currentQ) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ q, page: 1 }), 280);
    return () => clearTimeout(debounceRef.current);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = !!(currentQ || currentZemlja || currentPol);

  const nocOptions = availableNocs
    .map((noc) => {
      const entry = NOC_LIST.find((n) => n.noc === noc);
      return { noc, label: entry ? `${entry.name} (${noc})` : noc };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "sr"));

  return (
    <div className="space-y-3 mb-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* Search input */}
        <div className="relative flex-1 min-w-[220px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)] pointer-events-none"
            width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
          >
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 9l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ime ili prezime strelca…"
            aria-label="Pretraži strelce"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-4 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors"
          />
        </div>

        {/* Country select */}
        <select
          value={currentZemlja}
          onChange={(e) => push({ zemlja: e.target.value, page: 1 })}
          aria-label="Filtriraj po zemlji"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors cursor-pointer"
        >
          <option value="">Sve zemlje</option>
          {nocOptions.map(({ noc, label }) => (
            <option key={noc} value={noc}>{label}</option>
          ))}
        </select>

        {/* Gender pills */}
        <div
          className="flex rounded-lg border border-[var(--border)] overflow-hidden"
          role="group"
          aria-label="Pol strelca"
        >
          {GENDER_OPTIONS.map(([val, label]) => {
            const active = currentPol === val;
            return (
              <button
                key={val}
                onClick={() => push({ pol: val, page: 1 })}
                aria-pressed={active}
                className="px-3 py-2 text-xs font-semibold transition-colors"
                style={{
                  background: active ? "var(--brand-primary)" : "var(--bg)",
                  color: active ? "white" : "var(--muted)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Reset */}
        {isFiltered && (
          <button
            onClick={() => { setQ(""); router.replace(pathname); }}
            className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] px-3 py-2 rounded-lg hover:bg-[var(--surface)] transition-colors"
          >
            Resetuj ×
          </button>
        )}
      </div>

      {/* Count + Pagination */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--muted)]">
          {totalCount === 0 ? (
            "Nema strelaca za izabrane filtere."
          ) : shownCount < totalCount ? (
            <>
              <span className="font-semibold text-[var(--ink)]">
                {((page - 1) * 50 + 1).toLocaleString("sr")}–{((page - 1) * 50 + shownCount).toLocaleString("sr")}
              </span>
              {" od "}
              <span className="font-semibold text-[var(--ink)]">{totalCount.toLocaleString("sr")}</span>
              {" strelaca"}
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--ink)]">{totalCount.toLocaleString("sr")}</span>
              {" strelaca"}
            </>
          )}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => push({ page: page - 1 })}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30 transition-colors"
              aria-label="Prethodna strana"
            >
              ←
            </button>
            <span className="text-xs text-[var(--muted)] px-2 font-[family-name:var(--font-jetbrains-mono)]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => push({ page: page + 1 })}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] disabled:opacity-30 transition-colors"
              aria-label="Sledeća strana"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
