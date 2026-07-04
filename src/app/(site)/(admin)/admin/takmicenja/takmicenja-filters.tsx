"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";
import { SearchDropdown } from "@/components/ui/SearchDropdown";

const LEVEL_OPTIONS = [
  { value: "olympic",      label: "Olimpijsko" },
  { value: "world",        label: "Svetsko" },
  { value: "continental",  label: "Kontinentalno" },
  { value: "national",     label: "Državno" },
  { value: "regional",     label: "Regionalno" },
  { value: "club",         label: "Klubsko" },
];

const LEVEL_COLORS: Record<string, string> = {
  olympic:     "oklch(0.75 0.15 50)",
  world:       "oklch(0.55 0.18 240)",
  continental: "oklch(0.55 0.18 290)",
  national:    "oklch(0.50 0.16 145)",
  regional:    "oklch(0.60 0.15 30)",
  club:        "oklch(0.55 0.05 240)",
};

const LEVEL_OPTIONS_WITH_PREFIX = LEVEL_OPTIONS.map((o) => ({
  ...o,
  prefix: (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: LEVEL_COLORS[o.value] }}
    />
  ),
}));

const TAG_OPTIONS = [
  { value: "issf", label: "ISSF" },
  { value: "sss",  label: "SSS" },
  { value: "esc",  label: "ESC" },
];

interface Props {
  years: number[];
  currentLevel?: string;
  currentTag?: string;
}

export function TakmicenjaFilters({ years, currentLevel, currentTag }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function onSearch(v: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => update("q", v), 300);
  }

  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="flex gap-2 flex-wrap">
      <input
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Pretraži naziv..."
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] w-52"
      />
      <SearchDropdown
        value={params.get("year") ?? ""}
        onChange={(v) => update("year", v)}
        options={yearOptions}
        placeholder="Sve godine"
        emptyLabel="Sve godine"
        searchable={false}
        className="w-32"
      />
      <SearchDropdown
        value={currentLevel ?? params.get("level") ?? ""}
        onChange={(v) => update("level", v)}
        options={LEVEL_OPTIONS_WITH_PREFIX}
        placeholder="Svi nivoi"
        emptyLabel="Svi nivoi"
        searchable={false}
        className="w-44"
      />
      <SearchDropdown
        value={currentTag ?? params.get("tag") ?? ""}
        onChange={(v) => update("tag", v)}
        options={TAG_OPTIONS}
        placeholder="Svi tagovi"
        emptyLabel="Svi tagovi"
        searchable={false}
        labelClassName="font-[family-name:var(--font-jetbrains-mono)] font-semibold"
        className="w-36"
      />
    </div>
  );
}
