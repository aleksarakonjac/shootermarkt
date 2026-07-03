"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { NOC_LIST } from "@/components/ui/NocDropdown";

interface NatOption {
  code: string;
  name: string;
}

interface Props {
  nationalities: NatOption[];
  onlyUnverified: boolean;
  gender: string;
  apparatus: string;
}

const SELECT_CLS = "rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer";

export function StrelciFilters({ nationalities, onlyUnverified, gender, apparatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentNat = params.get("nat") ?? "";

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

  const natOptions = nationalities.map((n) => {
    const meta = NOC_LIST.find((m) => m.noc === n.code);
    return {
      value: n.code,
      label: n.code,
      sublabel: n.name !== n.code ? n.name : undefined,
      prefix: meta ? (
        <span
          className={`fi fi-${meta.alpha2.toLowerCase()}`}
          style={{ fontSize: "0.95em", borderRadius: "2px", flexShrink: 0 }}
        />
      ) : undefined,
    };
  });

  const hasActiveFilters = currentNat || gender || apparatus;

  return (
    <div className="flex gap-2 flex-wrap items-center">
      <input
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Pretraži ime..."
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] w-48"
      />

      <SearchDropdown
        value={currentNat}
        onChange={(v) => update("nat", v)}
        options={natOptions}
        placeholder="Sve nacije"
        emptyLabel="Sve nacije"
        searchPlaceholder="Pretraži naciju..."
        className="w-52"
      />

      <select
        value={gender}
        onChange={(e) => update("gender", e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">Oba pola</option>
        <option value="M">Muški</option>
        <option value="F">Ženski</option>
      </select>

      <select
        value={apparatus}
        onChange={(e) => update("apparatus", e.target.value)}
        className={SELECT_CLS}
      >
        <option value="">Sve discipline</option>
        <option value="rifle">Puška</option>
        <option value="pistol">Pištolj</option>
        <option value="both">Puška + Pištolj</option>
        <option value="shotgun">Shotgun</option>
      </select>

      {hasActiveFilters && (
        <button
          onClick={() => {
            update("nat", "");
            update("gender", "");
            update("apparatus", "");
          }}
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors px-1"
        >
          × Ukloni filtere
        </button>
      )}

      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--ink)]">
        <input
          type="checkbox"
          checked={onlyUnverified}
          onChange={() => update("verified", onlyUnverified ? "" : "0")}
          className="accent-[var(--brand-primary)] w-3.5 h-3.5 cursor-pointer"
        />
        Samo neverifikovani
      </label>
    </div>
  );
}
