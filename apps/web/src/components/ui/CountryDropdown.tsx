"use client";

import { SearchDropdown } from "./SearchDropdown";

type Country = { id: number; name: string; code2: string | null };

export function CountryDropdown({ value, onChange, countries }: { value: string; onChange: (value: string) => void; countries: Country[] }) {
  return (
    <SearchDropdown
      value={value}
      onChange={onChange}
      options={countries.map((country) => ({
        value: String(country.id),
        label: country.name,
        sublabel: country.code2 ?? undefined,
        prefix: country.code2 ? <span className={`fi fi-${country.code2.toLowerCase()}`} style={{ width: "16px", height: "11px", borderRadius: "2px", display: "inline-block" }} /> : undefined,
      }))}
      placeholder="Izaberi državu..."
      emptyLabel="— nije određena —"
      searchPlaceholder="Pretraži državu..."
    />
  );
}
