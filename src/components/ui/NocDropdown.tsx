"use client";

import { SearchDropdown } from "./SearchDropdown";
import { NOC_LIST } from "@/lib/noc-list";

export { NOC_LIST };

function Flag({ alpha2 }: { alpha2: string }) {
  return (
    <span
      className={`fi fi-${alpha2.toLowerCase()}`}
      style={{ fontSize: "0.95em", borderRadius: "2px", flexShrink: 0 }}
    />
  );
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function NocDropdown({ value, onChange, placeholder = "Zemlja...", className, disabled }: Props) {
  const options = NOC_LIST.map((n) => ({
    value: n.noc,
    label: n.noc,
    sublabel: n.name,
    prefix: <Flag alpha2={n.alpha2} />,
  }));

  return (
    <SearchDropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      emptyLabel="— bez nacije —"
      searchPlaceholder="Pretraži naciju..."
      labelClassName="font-[family-name:var(--font-jetbrains-mono)] font-semibold"
      className={className}
      disabled={disabled}
    />
  );
}
