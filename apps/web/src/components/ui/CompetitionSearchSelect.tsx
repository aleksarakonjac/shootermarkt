"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";

export interface CompetitionOption {
  id: number;
  name: string;
  nameSr?: string | null;
  date: string;
  dateEnd?: string | null;
  location?: string | null;
  level: CompetitionLevel;
}

const LEVEL_LABEL: Record<CompetitionLevel, string> = {
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

export function CompetitionSearchSelect({
  value,
  onChange,
  placeholder = "Izaberi takmičenje iz baze…",
  className = "",
}: Props) {
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setCompetitions(data);
        else setError(data.error ?? "Greška pri učitavanju takmičenja");
      })
      .catch((requestError) => setError(String(requestError)))
      .finally(() => setLoading(false));
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const selected = competitions.find((competition) => competition.id === value) ?? null;

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("sr");
    if (!normalizedQuery) return competitions;

    return competitions.filter((competition) =>
      [competition.name, competition.nameSr, competition.location, competition.date]
        .filter(Boolean)
        .some((item) => item!.toLocaleLowerCase("sr").includes(normalizedQuery))
    );
  }, [competitions, query]);

  const selectCompetition = (competition: CompetitionOption) => {
    onChange(competition);
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
      if (filtered[focusedIndex]) selectCompetition(filtered[focusedIndex]);
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
            <span className="truncate font-medium">{selected.nameSr || selected.name}</span>
            <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
              {formatDate(selected.date)}
            </span>
          </span>
        ) : (
          <span className="text-[var(--subtle)]">{loading ? "Učitavam takmičenja…" : placeholder}</span>
        )}
        <svg width="14" height="14" viewBox="0 0 14 14" className={`shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M3.5 5.5 7 9l3.5-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
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
              aria-activedescendant={filtered[focusedIndex] ? `${listboxId}-${filtered[focusedIndex].id}` : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFocusedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Pretraži po nazivu, mestu, datumu…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </div>
          <ul id={listboxId} role="listbox" className="max-h-[min(300px,calc(100vh-12rem))] w-full overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-[var(--muted)]">
                {competitions.length === 0 ? "Nema takmičenja u bazi" : "Nema poklapanja"}
              </li>
            ) : (
              filtered.map((competition, index) => (
                <li
                  key={competition.id}
                  role="none"
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`w-full max-w-none cursor-pointer text-sm transition-colors ${index === focusedIndex ? "bg-[var(--surface)]" : ""} ${competition.id === value ? "font-semibold" : ""}`}
                >
                  <button
                    type="button"
                    id={`${listboxId}-${competition.id}`}
                    role="option"
                    aria-selected={competition.id === value}
                    onClick={() => selectCompetition(competition)}
                    className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[var(--ink)]">{competition.nameSr || competition.name}</span>
                      {competition.location && <span className="block truncate text-xs text-[var(--muted)]">{competition.location}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="whitespace-nowrap rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.65rem] text-[var(--muted)]">
                        {LEVEL_LABEL[competition.level] ?? competition.level}
                      </span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--subtle)]">
                        {formatDate(competition.date)}
                      </span>
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
