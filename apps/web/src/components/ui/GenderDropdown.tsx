"use client";

import { SearchDropdown } from "./SearchDropdown";

const GENDER_OPTIONS = [
  { value: "M", label: "Muški" },
  { value: "F", label: "Ženski" },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function GenderDropdown({ value, onChange, className, disabled }: Props) {
  return (
    <SearchDropdown
      value={value}
      onChange={onChange}
      options={GENDER_OPTIONS}
      placeholder="Pol..."
      emptyLabel="—"
      searchable={false}
      className={className}
      disabled={disabled}
    />
  );
}
