"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

const LEVELS: { value: CompetitionLevel | "all"; label: string }[] = [
  { value: "all",         label: "Svi nivoi"    },
  { value: "olympic",     label: "Olimpijsko"   },
  { value: "world",       label: "Svetsko"      },
  { value: "continental", label: "Kont."        },
  { value: "national",    label: "Državno"      },
  { value: "regional",    label: "Regionalno"   },
  { value: "club",        label: "Klubsko"      },
];

const TAGS: { value: string; label: string; bg: string; activeBg: string; color: string }[] = [
  { value: "sss",  label: "SSS",  bg: "var(--surface-2)", activeBg: "oklch(0.52 0.15 145)", color: "white" },
  { value: "issf", label: "ISSF", bg: "var(--surface-2)", activeBg: "var(--brand-primary)",  color: "white" },
  { value: "esc",  label: "ESC",  bg: "var(--surface-2)", activeBg: "var(--brand-accent)",   color: "white" },
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

  const activeFiltersCount = [
    currentQ,
    currentYear !== "all" ? currentYear : "",
    currentLevel !== "all" ? currentLevel : "",
    currentTag,
  ].filter(Boolean).length;

  return (
    <div className="mb-6 space-y-3">
      {/* Row 1: search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
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
            placeholder="Pretraži takmičenja…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors"
          />
        </div>

        <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] shrink-0 ml-auto">
          {totalCount} {totalCount === 1 ? "takmičenje" : "takmičenja"}
        </span>

        {activeFiltersCount > 0 && (
          <button
            onClick={() => router.push("/takmicenja", { scroll: false })}
            className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--brand-primary)] transition-colors"
          >
            Resetuj ×
          </button>
        )}
      </div>

      {/* Row 2: year pills + separator + level + tags */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Year pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setParam("year", "all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              currentYear === "all"
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
            }`}
          >
            Sve
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setParam("year", y)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-[family-name:var(--font-jetbrains-mono)] transition-colors ${
                currentYear === y
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <span className="hidden sm:block h-4 w-px bg-[var(--border)] mx-1" aria-hidden="true" />

        {/* Level select */}
        <select
          value={currentLevel}
          onChange={(e) => setParam("level", e.target.value)}
          className="text-xs font-medium rounded-lg px-2.5 py-1 bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <span className="hidden sm:block h-4 w-px bg-[var(--border)] mx-1" aria-hidden="true" />

        {/* Tag pills */}
        <div className="flex items-center gap-1">
          {TAGS.map((t) => {
            const active = currentTag === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setParam("tag", active ? "" : t.value)}
                className="px-2.5 py-1 rounded-lg text-[0.65rem] font-[family-name:var(--font-jetbrains-mono)] font-semibold uppercase transition-colors"
                style={
                  active
                    ? { background: t.activeBg, color: t.color }
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
