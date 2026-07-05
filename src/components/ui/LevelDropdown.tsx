"use client";

import { SearchDropdown } from "./SearchDropdown";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

const LEVEL_OPTIONS: { value: CompetitionLevel; label: string }[] = [
  { value: "national",      label: "Državno" },
  { value: "regional",      label: "Regionalno" },
  { value: "international", label: "Međunarodno" },
  { value: "continental",   label: "Kontinentalno" },
  { value: "world",         label: "ISSF – Svetsko" },
  { value: "club",          label: "Klubsko" },
  { value: "olympic",       label: "Olimpijsko" },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function LevelDropdown({ value, onChange, className, disabled }: Props) {
  return (
    <SearchDropdown
      value={value}
      onChange={onChange}
      options={LEVEL_OPTIONS}
      placeholder="Nivo..."
      emptyLabel="—"
      searchable={false}
      className={className}
      disabled={disabled}
    />
  );
}
