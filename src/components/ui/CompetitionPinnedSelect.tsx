"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CompetitionOption } from "./CompetitionSearchSelect";

export type { CompetitionOption };

const LEVEL_LABEL: Record<string, string> = {
  club: "Klubsko",
  regional: "Regionalno",
  national: "Državno",
  international: "Međunarodno",
  continental: "Kontinentalno",
  world: "Svetsko",
  olympic: "Olimpijsko",
};

interface Props {
  value: number | null;
  onChange: (competition: CompetitionOption) => void;
  placeholder?: string;
  className?: string;
}

function formatDate(date: string) {
  return date.split("-").reverse().join(".");
}

function isOngoing(c: CompetitionOption, today: string) {
  return c.date <= today && (!c.dateEnd || c.dateEnd >= today);
}

export function CompetitionPinnedSelect({
  value,
  onChange,
  placeholder = "Izaberi takmičenje…",
  className = "",
}: Props) {
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCompetitions(data);
        else setError(data.error ?? "Greška pri učitavanju");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const sorted = useMemo(
    () => [...competitions].sort((a, b) => b.date.localeCompare(a.date)),
    [competitions]
  );

  const today = new Date().toISOString().split("T")[0];

  // pinned: ongoing first, then most recent — max 3
  const pinned = useMemo(() => {
    if (!sorted.length) return [];
    const ongoing = sorted.filter((c) => isOngoing(c, today));
    const rest = sorted.filter((c) => !isOngoing(c, today));
    return [...ongoing, ...rest].slice(0, 3);
  }, [sorted, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("sr");
    if (!q) return sorted;
    return sorted.filter((c) =>
      [c.name, c.nameSr, c.location, c.date]
        .filter(Boolean)
        .some((s) => s!.toLocaleLowerCase("sr").includes(q))
    );
  }, [sorted, query]);

  // when searching: flat list; otherwise: pinned + rest (excluding pinned)
  const pinnedIds = new Set(pinned.map((c) => c.id));
  const listItems = query ? filtered : filtered.filter((c) => !pinnedIds.has(c.id));

  const select = (c: CompetitionOption) => {
    onChange(c);
    setOpen(false);
    setQuery("");
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const total = (query ? 0 : pinned.length) + listItems.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const all = query ? listItems : [...pinned, ...listItems];
      if (all[focusedIndex]) select(all[focusedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  const selected = competitions.find((c) => c.id === value) ?? null;

  const itemClass = (id: number, flatIdx: number) =>
    `flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface)] focus:outline-none ${
      id === value ? "font-semibold" : ""
    } ${flatIdx === focusedIndex ? "bg-[var(--surface)]" : ""}`;

  function renderItem(c: CompetitionOption, flatIdx: number) {
    return (
      <button
        key={c.id}
        type="button"
        id={`${listboxId}-${c.id}`}
        role="option"
        aria-selected={c.id === value}
        onClick={() => select(c)}
        onMouseEnter={() => setFocusedIndex(flatIdx)}
        className={itemClass(c.id, flatIdx)}
      >
        <span className="min-w-0">
          <span className="block truncate text-[var(--ink)]">{c.nameSr || c.name}</span>
          {c.location && (
            <span className="block truncate text-xs text-[var(--muted)]">{c.location}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.65rem] text-[var(--muted)]">
            {LEVEL_LABEL[c.level] ?? c.level}
          </span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--subtle)]">
            {formatDate(c.date)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => { if (!o) setFocusedIndex(-1); return !o; })}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2.5 text-left text-sm text-[var(--ink)] transition-colors hover:border-[var(--brand-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{selected.nameSr || selected.name}</span>
            <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
              {formatDate(selected.date)}
            </span>
          </span>
        ) : (
          <span className="text-[var(--subtle)]">{loading ? "Učitavam…" : placeholder}</span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          className={`shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M3.5 5.5 7 9l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && (
        <div className="absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-[0_4px_8px_oklch(0_0_0/0.12)]">
          <div className="border-b border-[var(--border)] p-2">
            <input
              ref={inputRef}
              role="combobox"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocusedIndex(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Pretraži po nazivu, mestu, datumu…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </div>

          <ul
            id={listboxId}
            role="listbox"
            className="max-h-[min(340px,calc(100vh-12rem))] w-full overflow-y-auto py-1"
          >
            {competitions.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-[var(--muted)]">
                Nema takmičenja u bazi
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-[var(--muted)]">Nema poklapanja</li>
            ) : (
              <>
                {/* Pinned section (hidden while searching) */}
                {!query && pinned.length > 0 && (
                  <>
                    {pinned.map((c, i) => {
                      const ongoing = isOngoing(c, today);
                      const label = ongoing ? "Tekuće" : i === 0 ? "Nedavno" : null;
                      return (
                        <li key={c.id} role="none">
                          <button
                            type="button"
                            id={`${listboxId}-${c.id}`}
                            role="option"
                            aria-selected={c.id === value}
                            onClick={() => select(c)}
                            onMouseEnter={() => setFocusedIndex(i)}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--surface)] focus:outline-none ${
                              c.id === value ? "font-semibold" : ""
                            } ${i === focusedIndex ? "bg-[var(--surface)]" : ""}`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {label && (
                                <span
                                  className="shrink-0 text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                                  style={{
                                    color: ongoing ? "var(--brand-primary)" : "var(--muted)",
                                    border: `1px solid ${ongoing ? "var(--brand-primary)" : "var(--border)"}`,
                                  }}
                                >
                                  {label}
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-[var(--ink)]">
                                  {c.nameSr || c.name}
                                </span>
                                {c.location && (
                                  <span className="block truncate text-xs text-[var(--muted)]">
                                    {c.location}
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="whitespace-nowrap rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.65rem] text-[var(--muted)]">
                                {LEVEL_LABEL[c.level] ?? c.level}
                              </span>
                              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--subtle)]">
                                {formatDate(c.date)}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {listItems.length > 0 && (
                      <li role="none" className="flex items-center gap-3 px-3 py-1.5">
                        <div className="flex-1 border-t border-[var(--border)]" />
                        <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-[var(--subtle)]">
                          Sva takmičenja
                        </span>
                        <div className="flex-1 border-t border-[var(--border)]" />
                      </li>
                    )}
                  </>
                )}

                {/* Full list (or search results) */}
                {listItems.map((c, i) => (
                  <li key={c.id} role="none">
                    {renderItem(c, (query ? 0 : pinned.length) + i)}
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
