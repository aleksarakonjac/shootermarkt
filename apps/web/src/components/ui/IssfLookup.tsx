"use client";

import { useState } from "react";
import type { IssfCandidate } from "@shootermarkt/adapters/issf/sync";

const MATCH_LABEL: Record<IssfCandidate["match"], { text: string; color: string }> = {
  exact: { text: "tačno", color: "var(--success)" },
  close: { text: "slično", color: "var(--warning)" },
  weak:  { text: "slabo", color: "var(--subtle)" },
};

interface Props {
  firstName: string;
  lastName: string;
  noc?: string | null;
  /** Dugme na kandidatu; busy = taj kandidat se trenutno obrađuje */
  pickLabel: string;
  busyId?: string | null;
  onPick: (c: IssfCandidate) => void;
}

/** Pretraga ISSF baze po imenu za strelca bez issfId — admin bira kandidata. */
export function IssfLookup({ firstName, lastName, noc, pickLabel, busyId, onPick }: Props) {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [hits, setHits] = useState<IssfCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ first, last, ...(noc ? { noc } : {}) });
      const res = await fetch(`/api/admin/issf/athletes/lookup?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setHits(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const input = "text-sm px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] min-w-0";

  return (
    <div className="space-y-2">
      <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="flex flex-wrap gap-2">
        <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Prezime" aria-label="Prezime" className={`${input} flex-1`} />
        <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Ime" aria-label="Ime" className={`${input} flex-1`} />
        <button
          type="submit"
          disabled={loading || last.trim().length < 2}
          className="px-3 py-1 rounded-md text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--brand-primary)" }}
        >
          {loading ? "Tražim…" : "Traži u ISSF"}
        </button>
      </form>

      {error && <p className="text-xs" style={{ color: "var(--error)" }}>{error}</p>}
      {hits && hits.length === 0 && <p className="text-xs text-[var(--subtle)]">Nema strelca pod tim imenom u ISSF bazi.</p>}

      {hits && hits.length > 0 && (
        <div className="space-y-1">
          {hits.map((c) => (
            <div key={c.issfId} className="flex items-center gap-2.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 bg-[var(--bg)]">
              {c.portraitUrl && !c.portraitUrl.includes("result.issf-sports.info") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.portraitUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--ink)] truncate">
                  {c.lastName} {c.firstName}
                  <span className="ml-2 text-[0.65rem] font-semibold" style={{ color: MATCH_LABEL[c.match].color }}>{MATCH_LABEL[c.match].text}</span>
                </p>
                <p className="text-[0.65rem] text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
                  {c.nationCode}{c.birthYear ? ` · ${c.birthYear}` : ""}{c.gender ? ` · ${c.gender}` : ""} · {c.issfId}
                  {c.existingShooterId && <span className="ml-1" style={{ color: "var(--warning)" }}>· već u bazi #{c.existingShooterId}</span>}
                </p>
              </div>
              <button
                onClick={() => onPick(c)}
                disabled={!!busyId}
                className="px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 disabled:opacity-50"
                style={{ background: "oklch(0.95 0.04 260)", borderColor: "oklch(0.7 0.12 260)", color: "oklch(0.3 0.12 260)" }}
              >
                {busyId === c.issfId ? "…" : pickLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
