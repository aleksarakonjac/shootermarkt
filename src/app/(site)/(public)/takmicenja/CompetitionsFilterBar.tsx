"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

const LEVELS: { value: CompetitionLevel | "all"; label: string }[] = [
  { value: "all",           label: "Svi"          },
  { value: "olympic",       label: "Olimpijsko"   },
  { value: "world",         label: "Svetsko"      },
  { value: "continental",   label: "Kontinent."   },
  { value: "international", label: "Međunar."     },
  { value: "national",      label: "Državno"      },
  { value: "regional",      label: "Regionalno"   },
  { value: "club",          label: "Klubsko"      },
];

const DISCS = ["ARM","ARW","APM","APW"] as const;

const TAGS: { value: string; label: string; activeBg: string; activeColor: string }[] = [
  { value: "sss",  label: "SSS",  activeBg: "#f0fdf4", activeColor: "#15803d" },
  { value: "issf", label: "ISSF", activeBg: "#fef2f2", activeColor: "#b91c1c" },
  { value: "esc",  label: "ESC",  activeBg: "#eff6ff", activeColor: "#1d4ed8" },
];

interface Props {
  availableYears: string[];
  currentYear: string;
  currentLevel: string;
  currentQ: string;
  currentTag: string;
  currentDisc: string;
  totalCount: number;
}

export function CompetitionsFilterBar({
  availableYears,
  currentYear,
  currentLevel,
  currentQ,
  currentTag,
  currentDisc,
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

  const hasFilters =
    currentQ ||
    currentYear !== "all" ||
    currentLevel !== "all" ||
    currentTag ||
    currentDisc !== "all";

  const pill =
    "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer";
  const pillOn  = "bg-[var(--ink)] text-[var(--bg)]";
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
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:border-[var(--brand-primary)] transition-colors"
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

      {/* Row 2: discipline pills + divider + source tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setParam("disc", "all")}
          className={`${pill} font-[family-name:var(--font-jetbrains-mono)] ${currentDisc === "all" ? pillOn : pillOff}`}
        >
          Sve discipl.
        </button>
        {DISCS.map((d) => (
          <button
            key={d}
            onClick={() => setParam("disc", d)}
            className={`${pill} font-[family-name:var(--font-jetbrains-mono)] ${currentDisc === d ? pillOn : pillOff}`}
          >
            {d}
          </button>
        ))}

        <span className="h-4 w-px bg-[var(--border)] mx-1 shrink-0" aria-hidden="true" />

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

      {/* Row 3: year pills + divider + level pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setParam("year", "all")}
          className={`${pill} font-[family-name:var(--font-jetbrains-mono)] ${currentYear === "all" ? pillOn : pillOff}`}
        >
          Sve god.
        </button>
        {availableYears.map((y) => (
          <button
            key={y}
            onClick={() => setParam("year", y)}
            className={`${pill} font-[family-name:var(--font-jetbrains-mono)] ${currentYear === y ? pillOn : pillOff}`}
          >
            {y}
          </button>
        ))}

        <span className="h-4 w-px bg-[var(--border)] mx-1 shrink-0" aria-hidden="true" />

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

    </div>
  );
}
