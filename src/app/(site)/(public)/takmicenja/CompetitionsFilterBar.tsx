"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

const LEVELS: { value: CompetitionLevel | "all"; label: string }[] = [
  { value: "all",           label: "Svi"           },
  { value: "olympic",       label: "Olimpijsko"    },
  { value: "world",         label: "Svetsko"       },
  { value: "continental",   label: "Kontinentalno" },
  { value: "international", label: "Međunarodno"   },
  { value: "national",      label: "Državno"       },
  { value: "regional",      label: "Regionalno"    },
  { value: "club",          label: "Klubsko"       },
];

const TAGS: { value: string; label: string; activeBg: string; activeColor: string }[] = [
  { value: "sss",  label: "SSS",  activeBg: "var(--tag-sss-bg)",  activeColor: "var(--tag-sss-fg)" },
  { value: "issf", label: "ISSF", activeBg: "var(--tag-issf-bg)", activeColor: "var(--tag-issf-fg)" },
  { value: "esc",  label: "ESC",  activeBg: "var(--tag-esc-bg)",  activeColor: "var(--tag-esc-fg)" },
];

interface Props {
  availableYears: string[];
  currentYear: string;
  currentLevel: string;
  currentQ: string;
  currentTag: string;
  totalCount: number;
}

export function CompetitionsFilterBar({
  availableYears,
  currentYear,
  currentLevel,
  currentQ,
  currentTag,
  totalCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [yearOpen, setYearOpen] = useState(false);
  const yearRef = useRef<HTMLDivElement>(null);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/takmicenja?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const onSearch = useCallback(
    (v: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setParam("q", v), 280);
    },
    [setParam]
  );

  // Close year dropdown on outside click or Escape
  useEffect(() => {
    if (!yearOpen) return;
    function onDown(e: MouseEvent) {
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) setYearOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setYearOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [yearOpen]);

  const hasFilters = currentQ || currentLevel !== "all" || currentTag;

  const pill =
    "px-2.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer";
  const pillOn  = "bg-[var(--brand-primary)] text-white";
  const pillOff = "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]";

  return (
    <div className="mb-8 space-y-2">

      {/* Row 1: search + count + reset */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg
            width="14" height="14" viewBox="0 0 14 14"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            defaultValue={currentQ}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Pretraži…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors"
          />
        </div>
        <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] tabular-nums ml-auto shrink-0">
          {totalCount}
        </span>
        {hasFilters && (
          <button
            onClick={() => router.push("/takmicenja", { scroll: false })}
            className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--brand-primary)] transition-colors"
          >
            Resetuj ×
          </button>
        )}
      </div>

      {/* Row 2: year dropdown + divider + level pills + divider + source tags */}
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* Year — custom dropdown */}
        <div ref={yearRef} className="relative shrink-0">
          <button
            onClick={() => setYearOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={yearOpen}
            aria-label="Filter po godini"
            className={`${pill} bg-[var(--ink)] text-[var(--bg)] font-[family-name:var(--font-jetbrains-mono)] flex items-center gap-1.5`}
          >
            {currentYear}
            <svg
              width="10" height="10" viewBox="0 0 10 10"
              className={`shrink-0 transition-transform duration-150 ${yearOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>

          {yearOpen && (
            <div
              role="listbox"
              aria-label="Godina"
              className="absolute top-[calc(100%+4px)] left-0 z-[var(--z-dropdown)] min-w-[80px] rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-[0_4px_16px_oklch(0_0_0/0.12)] py-1 overflow-hidden"
            >
              {availableYears.map((y) => (
                <button
                  key={y}
                  role="option"
                  aria-selected={y === currentYear}
                  onClick={() => { setParam("year", y); setYearOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold font-[family-name:var(--font-jetbrains-mono)] transition-colors ${
                    y === currentYear
                      ? "bg-[var(--surface-2)] text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="h-4 w-px bg-[var(--border)] mx-1 shrink-0" aria-hidden="true" />

        <div role="group" aria-label="Filter po nivou takmičenja" className="contents">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => setParam("level", l.value)}
              className={`${pill} ${currentLevel === l.value || (l.value === "all" && currentLevel === "all") ? pillOn : pillOff}`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <span className="h-4 w-px bg-[var(--border)] mx-1 shrink-0" aria-hidden="true" />

        <div role="group" aria-label="Filter po organizatoru" className="contents">
          {TAGS.map((t) => {
            const active = currentTag === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setParam("tag", active ? "" : t.value)}
                className={`${pill} font-[family-name:var(--font-jetbrains-mono)]`}
                style={
                  active
                    ? { background: t.activeBg, color: t.activeColor }
                    : { background: "var(--surface-2)", color: "var(--muted)" }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
