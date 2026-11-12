"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuotaManager } from "../takmicenja/[id]/edit/quota-manager";

export type QuotaCompetitionRow = { id: number; name: string; date: string; dateEnd: string | null; location: string | null; level: string; places: number; awarded: number };
export type QuotaCandidate = { id: number; name: string; date: string; location: string | null };

const fmtRange = (from: string, to: string | null) => {
  const f = (iso: string) => iso.split("-").reverse().join(".") + ".";
  return to && to !== from ? `${f(from)} – ${f(to)}` : f(from);
};

function Row({ id, name, date, dateEnd, location, status, isOpen, onToggle, onChanged }: {
  id: number; name: string; date: string; dateEnd?: string | null; location: string | null; status: string;
  isOpen: boolean; onToggle: (id: number) => void; onChanged: () => void;
}) {
  return (
    <li className="rounded-lg border border-[var(--border)]">
      <button type="button" onClick={() => onToggle(id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface)] rounded-lg">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={`shrink-0 text-[var(--muted)] transition-transform ${isOpen ? "rotate-90" : ""}`}>
          <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{fmtRange(date, dateEnd ?? null)}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">{name}{location ? <span className="font-normal text-[var(--muted)]"> · {location}</span> : null}</span>
        <span className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">{status}</span>
      </button>
      {isOpen && (
        <div className="border-t border-[var(--border)] px-3 py-4">
          <QuotaManager competitionId={id} embedded onChanged={onChanged} />
        </div>
      )}
    </li>
  );
}

/**
 * Kvote sa takmičenja na jednom mestu: lista svih takmičenja koja dele kvote (sa zbirom dodeljenih), a klik otvara
 * podešavanje mesta i dodelu kvota tog takmičenja (isti alat kao na stranici takmičenja).
 */
export function CompetitionQuotas({ competitions, candidates }: { competitions: QuotaCompetitionRow[]; candidates: QuotaCandidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [added, setAdded] = useState<QuotaCandidate[]>([]);
  const [pick, setPick] = useState("");

  const known = new Set(competitions.map((c) => c.id));
  const fresh = added.filter((a) => !known.has(a.id));
  const available = candidates.filter((c) => !known.has(c.id) && !added.some((a) => a.id === c.id));

  const refresh = () => router.refresh();
  const toggle = (id: number) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <section className="rounded-xl border border-[var(--border)] p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Kvote sa takmičenja</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">Sva takmičenja koja dele kvote. Otvori takmičenje da podesiš broj mesta po disciplini i dodeliš kvote.</p>

      <ul className="space-y-2">
        {fresh.map((c) => <Row key={`new-${c.id}`} id={c.id} name={c.name} date={c.date} location={c.location} status="novo" isOpen={open.has(c.id)} onToggle={toggle} onChanged={refresh} />)}
        {competitions.map((c) => <Row key={c.id} id={c.id} name={c.name} date={c.date} dateEnd={c.dateEnd} location={c.location} status={`${c.awarded}/${c.places}`} isOpen={open.has(c.id)} onToggle={toggle} onChanged={refresh} />)}
      </ul>
      {competitions.length === 0 && fresh.length === 0 && <p className="text-sm text-[var(--muted)]">Još nijedno takmičenje ne deli kvote.</p>}

      {available.length > 0 && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = available.find((a) => String(a.id) === pick);
            if (!c) return;
            setAdded((prev) => [...prev, c]);
            setOpen((prev) => new Set(prev).add(c.id));
            setPick("");
          }}
        >
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Dodaj takmičenje" className="max-w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--ink)]">
            <option value="">Dodaj takmičenje koje deli kvote…</option>
            {available.map((c) => <option key={c.id} value={c.id}>{fmtRange(c.date, null)} · {c.name}{c.location ? ` · ${c.location}` : ""}</option>)}
          </select>
          <button type="submit" disabled={!pick} className="rounded-md border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50">Dodaj</button>
        </form>
      )}
    </section>
  );
}
