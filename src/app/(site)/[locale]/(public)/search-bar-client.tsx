"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";

interface SearchShooterItem {
  id: number;
  firstName: string;
  lastName: string;
  clubName: string | null;
}

interface SearchBarClientProps {
  shootersList: SearchShooterItem[];
}

export function SearchBarClient({ shootersList }: SearchBarClientProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = query
    ? shootersList.filter((s) => {
        const full = `${s.firstName} ${s.lastName} ${s.clubName || ""}`.toLowerCase();
        return full.includes(query.toLowerCase());
      })
    : [];

  const handleSelect = (id: number) => {
    setQuery("");
    setIsOpen(false);
    router.push(`/strelci/${id}`);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Search Input Container */}
      <div className="relative rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] focus-within:border-[var(--brand-primary)] focus-within:ring-1 focus-within:ring-[var(--brand-primary)] transition-all">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[var(--subtle)]">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M7.333 12.667A5.333 5.333 0 107.333 2a5.333 5.333 0 000 10.667zM14 14l-2.9-2.9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Pretraži strelce..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full text-sm pl-8 pr-3 py-1.5 bg-transparent text-[var(--ink)] placeholder-[var(--subtle)] outline-none rounded-lg"
          aria-label="Pretraga strelaca"
        />
      </div>

      {/* Dropdown Results */}
      {isOpen && query && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[300] bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-[var(--border)]">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--muted)] text-center">
              Nema rezultata za "{query}"
            </div>
          ) : (
            filtered.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                className="w-full text-left px-4 py-2.5 hover:bg-[var(--surface)] flex flex-col gap-0.5 text-sm transition-colors"
              >
                <span className="font-semibold text-[var(--ink)]">
                  {s.lastName} {s.firstName}
                </span>
                {s.clubName && (
                  <span className="text-xs text-[var(--muted)]">{s.clubName}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
