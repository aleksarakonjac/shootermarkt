"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { LEVEL_DOT_COLOR } from "@/lib/competition-utils";
import { FOCUS_PRIORITY_TIERS } from "@/lib/competition-priority";

const LEVEL_OPTIONS = [
  { value: "olympic",       label: "Olimpijsko" },
  { value: "world",         label: "Svetsko" },
  { value: "continental",   label: "Kontinentalno" },
  { value: "international", label: "Međunarodno" },
  { value: "national",      label: "Državno" },
  { value: "regional",      label: "Regionalno" },
  { value: "club",          label: "Klubsko" },
];


const LEVEL_OPTIONS_WITH_PREFIX = LEVEL_OPTIONS.map((o) => ({
  ...o,
  prefix: (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: LEVEL_DOT_COLOR[o.value] }}
    />
  ),
}));

export const TAG_OPTIONS = [
  { value: "issf", label: "ISSF" },
  { value: "sss",  label: "SSS" },
  { value: "esc",  label: "ESC" },
  { value: "10m", label: "10m" },
  { value: "MK", label: "MK" },
  { value: "50m", label: "50m" },
  { value: "25m", label: "25m" },
  { value: "50/25m", label: "50/25m" },
];

const PRIORITY_OPTIONS = [
  { value: "manual", label: "Ručno postavljen" },
  { value: "auto",   label: "Automatski" },
  ...FOCUS_PRIORITY_TIERS.map((t) => ({ value: String(t.value), label: `${t.value} · ${t.label}` })),
  { value: "11+",    label: "11+ · mlađe kategorije / 300m" },
];

interface Props {
  years: number[];
  currentLevel?: string;
  currentTag?: string;
  currentPriority?: string;
}

export function TakmicenjaFilters({ years, currentLevel, currentTag, currentPriority }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentYear = new Date().getFullYear().toString();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "year") {
      // Ensure a year is always set; fallback to currentYear if cleared
      if (value) next.set(key, value);
      else next.set(key, currentYear);
    } else if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function onSearch(v: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update("q", v), 300);
  }

  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <input
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Pretraži naziv..."
        className="rounded-md border border-[var(--border)] px-3 py-2.5 text-base sm:py-1.5 sm:text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] col-span-2 w-full sm:w-52"
      />
      <SearchDropdown
        value={params.get("year") ?? currentYear}
        onChange={(v) => update("year", v)}
        options={yearOptions}
        placeholder={currentYear}
        searchable={false}
        className="sm:w-32"
      />
      <SearchDropdown
        value={currentLevel ?? params.get("level") ?? ""}
        onChange={(v) => update("level", v)}
        options={LEVEL_OPTIONS_WITH_PREFIX}
        placeholder="Svi nivoi"
        emptyLabel="Svi nivoi"
        searchable={false}
        className="sm:w-44"
      />
      <SearchDropdown
        value={currentTag ?? params.get("tag") ?? ""}
        onChange={(v) => update("tag", v)}
        options={TAG_OPTIONS}
        placeholder="Svi tagovi"
        emptyLabel="Svi tagovi"
        searchable={false}
        labelClassName="font-[family-name:var(--font-jetbrains-mono)] font-semibold"
        className="sm:w-36"
      />
      <SearchDropdown
        value={currentPriority ?? params.get("priority") ?? ""}
        onChange={(v) => update("priority", v)}
        options={PRIORITY_OPTIONS}
        placeholder="Svi prioriteti"
        emptyLabel="Svi prioriteti"
        searchable={false}
        className="sm:w-64"
      />
    </div>
  );
}
