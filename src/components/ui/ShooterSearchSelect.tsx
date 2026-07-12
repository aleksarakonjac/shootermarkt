"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { NOC_LIST } from "@/lib/noc-list";

export interface ShooterOption {
  id: number;
  firstName: string;
  lastName: string;
  nationality?: string | null;
  clubName?: string | null;
}

interface Props {
  value: number | null;
  onChange: (shooter: ShooterOption) => void;
  /**
   * Preloaded candidate list — filtering happens client-side, no network calls.
   * Use this when the picker is scoped to a known roster (e.g. discipline-locked
   * head-to-head compare). Omit to search the full shooter database live instead.
   */
  options?: ShooterOption[];
  /** Hide one option by id — typically the shooter picked in a paired selector. */
  excludeId?: number | null;
  placeholder?: string;
  className?: string;
}

function nocAlpha2(noc: string | null | undefined): string | null {
  if (!noc) return null;
  return NOC_LIST.find((n) => n.noc === noc)?.alpha2 ?? null;
}

function FlagChip({ noc }: { noc: string | null | undefined }) {
  const a2 = nocAlpha2(noc);
  if (!a2) return null;
  return (
    <span
      className={`fi fi-${a2.toLowerCase()} shrink-0`}
      style={{ width: "14px", height: "10px", borderRadius: "2px", display: "inline-block" }}
      aria-hidden="true"
    />
  );
}

export function ShooterSearchSelect({
  value,
  onChange,
  options,
  excludeId = null,
  placeholder = "Pretraži strelca…",
  className = "",
}: Props) {
  const isLocal = options !== undefined;

  const [remoteResults, setRemoteResults] = useState<ShooterOption[]>([]);
  // Tracks the last shooter explicitly picked so the display name persists
  // after remoteResults is cleared. Set only in selectShooter (event handler).
  const [lastPicked, setLastPicked] = useState<ShooterOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleOutsidePointer);
    return () => document.removeEventListener("mousedown", handleOutsidePointer);
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  // Remote mode: debounced live search
  useEffect(() => {
    if (isLocal || !open) return;
    const q = query.trim();
    const handle = setTimeout(async () => {
      if (q.length < 2) { setRemoteResults([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/cms/shooters-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setRemoteResults(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    }, q.length < 2 ? 0 : 250);
    return () => clearTimeout(handle);
  }, [isLocal, open, query]);

  const pool = isLocal ? options! : remoteResults;

  const filtered = useMemo(() => {
    const base = pool.filter((s) => s.id !== excludeId);
    if (!isLocal) return base; // already server-filtered
    const normalizedQuery = query.trim().toLocaleLowerCase("sr");
    if (!normalizedQuery) return base;
    return base.filter((s) =>
      [s.firstName, s.lastName, s.clubName]
        .filter(Boolean)
        .some((item) => item!.toLocaleLowerCase("sr").includes(normalizedQuery))
    );
  }, [pool, excludeId, isLocal, query]);

  const selected = isLocal
    ? options!.find((s) => s.id === value) ?? null
    : value == null
      ? null
      : remoteResults.find((r) => r.id === value) ??
        (lastPicked?.id === value ? lastPicked : null);

  const selectShooter = (shooter: ShooterOption) => {
    onChange(shooter);
    if (!isLocal) setLastPicked(shooter);
    setOpen(false);
    setQuery("");
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[focusedIndex]) selectShooter(filtered[focusedIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  const toggle = () => {
    setOpen((isOpen) => {
      if (isOpen) setQuery("");
      else setFocusedIndex(0);
      return !isOpen;
    });
  };

  const emptyMessage = isLocal
    ? (options!.length === 0 ? "Nema dostupnih strelaca" : "Nema poklapanja")
    : query.trim().length < 2
    ? "Ukucaj bar 2 slova…"
    : loading
    ? "Tražim…"
    : "Nema poklapanja";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2.5 text-left text-sm text-[var(--ink)] transition-colors hover:border-[var(--brand-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <FlagChip noc={selected.nationality} />
            <span className="truncate font-medium">
              {selected.lastName} {selected.firstName}
            </span>
            {selected.clubName && (
              <span className="shrink-0 truncate text-xs text-[var(--muted)]">
                {selected.clubName}
              </span>
            )}
          </span>
        ) : (
          <span className="text-[var(--subtle)]">{placeholder}</span>
        )}
        <svg width="14" height="14" viewBox="0 0 14 14" className={`shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-[0_4px_8px_oklch(0_0_0/0.12)]">
          <div className="border-b border-[var(--border)] p-2">
            <input
              ref={inputRef}
              role="combobox"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-autocomplete="list"
              aria-activedescendant={filtered[focusedIndex] ? `${listboxId}-${filtered[focusedIndex].id}` : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFocusedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Pretraži po imenu ili prezimenu…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </div>
          <ul id={listboxId} role="listbox" className="max-h-[min(300px,calc(100vh-12rem))] w-full overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-[var(--muted)]">{emptyMessage}</li>
            ) : (
              filtered.map((shooter, index) => (
                <li
                  key={shooter.id}
                  role="none"
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`w-full max-w-none cursor-pointer text-sm transition-colors ${index === focusedIndex ? "bg-[var(--surface)]" : ""} ${shooter.id === value ? "font-semibold" : ""}`}
                >
                  <button
                    type="button"
                    id={`${listboxId}-${shooter.id}`}
                    role="option"
                    aria-selected={shooter.id === value}
                    onClick={() => selectShooter(shooter)}
                    className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary)]"
                  >
                    <FlagChip noc={shooter.nationality} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[var(--ink)]">
                        {shooter.lastName} {shooter.firstName}
                      </span>
                      {shooter.clubName && (
                        <span className="block truncate text-xs text-[var(--muted)]">{shooter.clubName}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
