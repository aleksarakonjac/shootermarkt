"use client";

import { forwardRef } from "react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const CustomCheckbox = forwardRef<HTMLInputElement, Props>(function CustomCheckbox(
  { checked, onChange, label, disabled, className },
  ref
) {
  return (
    <label className={`relative flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--ink)] ${className ?? ""}`}>
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="appearance-none w-4 h-4 rounded border border-[var(--border)] bg-[var(--bg)] checked:bg-[var(--brand-primary)] checked:border-[var(--brand-primary)] focus:outline-none transition-colors relative"
      />
      <span
        className={`absolute left-0 flex items-center justify-center w-4 h-4 text-white pointer-events-none transition-opacity ${
          checked ? "opacity-100" : "opacity-0"
        }`}
        style={{ fontSize: "0.75rem" }}
      >
        ✓
      </span>
      {label && <span>{label}</span>}
    </label>
  );
});
