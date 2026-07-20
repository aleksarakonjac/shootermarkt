"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewRow } from "@/lib/pdf-import/types";

type ShooterHit = {
  id: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  clubName: string | null;
};

interface Props {
  row: ReviewRow;
  onChange: (patch: Partial<ReviewRow>) => void;
}

export function ShooterMatchCell({ row, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ShooterHit[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim() || `${row.lastName} ${row.firstName}`.trim();
    const handle = setTimeout(async () => {
      if (q.length < 2) { setHits([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/shooters?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(Array.isArray(data) ? data.slice(0, 8) : []);
      } finally {
        setLoading(false);
      }
    }, q.length < 2 ? 0 : 250);
    return () => clearTimeout(handle);
  }, [open, query, row.lastName, row.firstName]);

  function pick(hit: ShooterHit) {
    onChange({
      shooterId: hit.id,
      isNew: false,
      suggestedShooterId: undefined,
      suggestedName: undefined,
      warning: undefined,
    });
    setOpen(false);
    setQuery("");
  }

  function forceNew() {
    onChange({
      shooterId: undefined,
      isNew: true,
      suggestedShooterId: undefined,
      suggestedName: undefined,
      warning: "Novi strelac — biće kreiran",
    });
    setOpen(false);
  }

  function acceptSuggestion() {
    if (!row.suggestedShooterId) return;
    onChange({
      shooterId: row.suggestedShooterId,
      isNew: false,
      suggestedShooterId: undefined,
      suggestedName: undefined,
      warning: undefined,
    });
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-1">
        {row.shooterId ? (
          <span className="text-sm leading-none" style={{ color: "var(--success)" }} title="Pronađen">✓</span>
        ) : row.suggestedShooterId ? (
          <button
            onClick={acceptSuggestion}
            title={`Možda: ${row.suggestedName} — klikni da prihvatiš`}
            className="text-sm leading-none"
            style={{ color: "var(--warning)" }}
          >⚠</button>
        ) : (
          <span className="text-sm leading-none text-[var(--subtle)]" title="Novi strelac">+</span>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          title="Promeni strelca"
          className="ml-0.5 text-[0.75rem] leading-none text-[var(--subtle)] hover:text-[var(--brand-primary)] transition-colors"
        >✏</button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 left-0 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Traži: ${row.lastName} ${row.firstName}`}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] mb-1.5"
          />
          <div className="max-h-48 overflow-auto space-y-0.5">
            {loading && <div className="text-[0.65rem] text-[var(--subtle)] px-2 py-1">Tražim…</div>}
            {!loading && hits.length === 0 && (
              <div className="text-[0.65rem] text-[var(--subtle)] px-2 py-1">Nema rezultata.</div>
            )}
            {hits.map((h) => (
              <button
                key={h.id}
                onClick={() => pick(h)}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-[var(--surface-2)] flex items-center justify-between gap-2"
              >
                <span className="text-[var(--ink)]">{h.lastName} {h.firstName}</span>
                <span className="text-[0.6rem] text-[var(--subtle)] shrink-0">
                  {h.nationality ?? ""} {h.clubName ? `· ${h.clubName}` : ""}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={forceNew}
            className="w-full mt-1.5 text-left px-2 py-1.5 rounded-md text-[0.65rem] font-semibold text-[var(--brand-primary)] hover:bg-[var(--surface-2)]"
          >
            + Kreiraj kao novog strelca
          </button>
        </div>
      )}
    </div>
  );
}
