"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  prefix?: ReactNode;
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  onCreateNew?: (query: string) => void | Promise<void>;
  createNewLabel?: (query: string) => string;
  className?: string;
  labelClassName?: string;
  showSelectedSublabel?: boolean;
  align?: "left" | "right";
  disabled?: boolean;
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10" fill="none"
    className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    aria-hidden="true"
  >
    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function SearchDropdown({
  id,
  value,
  onChange,
  options,
  placeholder = "Izaberi...",
  emptyLabel = "— bez izbora —",
  searchPlaceholder = "Pretraži...",
  searchable = true,
  onCreateNew,
  createNewLabel = (q) => `+ Kreiraj "${q}"`,
  className = "",
  labelClassName = "",
  showSelectedSublabel = true,
  align = "left",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = search
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(search.toLowerCase()) ||
          o.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  async function handleCreate() {
    if (!onCreateNew || creating) return;
    setCreating(true);
    try {
      await onCreateNew(search.trim());
      setSearch("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  const showCreate = !!onCreateNew && search.trim().length > 0;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {selected ? (
            <>
              {selected.prefix && <span className="shrink-0">{selected.prefix}</span>}
              <span className={`truncate ${labelClassName}`}>{selected.label}</span>
              {showSelectedSublabel && selected.sublabel && (
                <span className="shrink-0 text-[var(--muted)] text-xs">{selected.sublabel}</span>
              )}
            </>
          ) : (
            <span className="text-[var(--subtle)]">{placeholder}</span>
          )}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className={`absolute top-full mt-1 z-50 min-w-full w-max max-w-xs rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg ${align === "right" ? "right-0" : "left-0"}`}>
          {searchable && (
            <div className="p-1.5 border-b border-[var(--border)]">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded px-2.5 py-1.5 text-xs text-[var(--ink)] bg-[var(--surface)] focus:outline-none placeholder:text-[var(--subtle)]"
              />
            </div>
          )}

          <div className="max-h-52 overflow-y-auto">
            {/* Empty/clear option */}
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className="w-full text-left px-3 py-2 text-xs text-[var(--subtle)] hover:bg-[var(--surface)] transition-colors"
            >
              {emptyLabel}
            </button>

            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface)] transition-colors flex items-center gap-1.5"
                style={{
                  fontWeight: o.value === value ? 700 : 400,
                  color: o.value === value ? "var(--brand-primary)" : "var(--ink)",
                }}
              >
                {o.prefix && <span className="shrink-0">{o.prefix}</span>}
                <span className={`truncate ${labelClassName}`}>{o.label}</span>
                {o.sublabel && <span className="text-[var(--muted)] shrink-0">{o.sublabel}</span>}
              </button>
            ))}

            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-xs text-[var(--subtle)]">Nema rezultata</p>
            )}

            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)] transition-colors disabled:opacity-50 border-t border-[var(--border)]"
                style={{ color: "var(--brand-primary)" }}
              >
                {creating ? "Kreiram..." : createNewLabel(search.trim())}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
