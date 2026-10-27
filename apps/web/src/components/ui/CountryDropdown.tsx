"use client";

import { SearchDropdown } from "./SearchDropdown";
import { countryKeywords } from "@/lib/country-search";

export type Country = {
  id: number;
  name: string;
  code2: string | null;
  code?: string | null;
  nocCode?: string | null;
  nameSr?: string | null;
  nameEn?: string | null;
};

export function CountryDropdown({ value, onChange, countries }: { value: string; onChange: (value: string) => void; countries: Country[] }) {
  return (
    <SearchDropdown
      value={value}
      onChange={onChange}
      options={countries.map((country) => ({
        value: String(country.id),
        label: country.nameSr ?? country.name,
        sublabel: country.code ?? country.code2 ?? undefined,
        keywords: countryKeywords(country.code2, country.name, country.nameEn, country.code2, country.nocCode),
        prefix: country.code2 ? <span className={`fi fi-${country.code2.toLowerCase()}`} style={{ width: "16px", height: "11px", borderRadius: "2px", display: "inline-block" }} /> : undefined,
      }))}
      placeholder="Izaberi državu..."
      emptyLabel="— nije određena —"
      searchPlaceholder="Pretraži državu (ime, SRB…)"
    />
  );
}
