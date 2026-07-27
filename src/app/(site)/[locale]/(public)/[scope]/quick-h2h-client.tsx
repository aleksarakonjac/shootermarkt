"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { compareShooters, ComparisonResult } from "./actions";

type Shooter = { id: number; firstName: string; lastName: string; clubName: string | null };

function ShooterSearch({ label, excludedId, onSelect }: { label: string; excludedId: string; onSelect: (shooter: Shooter) => void }) {
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Shooter[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?only=shooters&q=${encodeURIComponent(query)}&scope=${scope ?? "srb"}&locale=${locale}`, { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setResults(data.shooters.filter((shooter: Shooter) => String(shooter.id) !== excludedId));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
      }
    }, 150);
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [excludedId, locale, query, scope]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</label>
      <div className="relative">
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setResults([]); }}
          placeholder="Pretraži..."
          className="w-full text-xs rounded border border-[var(--border-strong)] p-1.5 bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
          autoComplete="off"
        />
        {query.trim().length >= 2 && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg max-h-48 overflow-y-auto">
            {results.map((shooter) => (
              <li key={shooter.id}>
                <button
                  onClick={() => { onSelect(shooter); setQuery(`${shooter.lastName} ${shooter.firstName}`); setResults([]); }}
                  className="w-full px-2 py-1 text-left text-xs hover:bg-[var(--surface)]"
                >
                  {shooter.lastName} {shooter.firstName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function QuickH2HClient() {
  const [shooterA, setShooterA] = useState<Shooter | null>(null);
  const [shooterB, setShooterB] = useState<Shooter | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const compare = (a: Shooter | null, b: Shooter | null) => {
    if (!a || !b) return setResult(null);
    startTransition(async () => setResult(await compareShooters(a.id, b.id)));
  };

  const commonDisciplines = result?.shooterA && result?.shooterB
    ? Object.keys(result.shooterA.disciplines).filter((code) => Object.prototype.hasOwnProperty.call(result.shooterB!.disciplines, code))
    : [];

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-[var(--ink)] uppercase tracking-wider">Direktni duel</h3>
      </div>
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <ShooterSearch label="Strelac A" excludedId={String(shooterB?.id ?? "")} onSelect={(shooter) => { setShooterA(shooter); compare(shooter, shooterB); }} />
          <ShooterSearch label="Strelac B" excludedId={String(shooterA?.id ?? "")} onSelect={(shooter) => { setShooterB(shooter); compare(shooterA, shooter); }} />
        </div>
        {isPending && <p className="py-10 text-center text-xs text-[var(--muted)]">Računam statistiku...</p>}
        {!isPending && !result && <p className="py-10 text-center text-xs text-[var(--muted)]">Izaberi dva strelca za poređenje.</p>}
        {!isPending && result?.shooterA && result.shooterB && (
          <div className="flex flex-col gap-3">
            <div className="flex h-6 overflow-hidden rounded text-center text-xs font-bold text-white">
              {result.h2hRecord.total === 0 ? <span className="w-full bg-[var(--surface)] py-1 text-[var(--muted)]">Nema zajedničkih mečeva</span> : <>
                <span className="bg-[var(--brand-primary)]" style={{ width: `${(result.h2hRecord.winsA / result.h2hRecord.total) * 100}%` }}>{result.h2hRecord.winsA}</span>
                <span className="bg-[var(--subtle)]" style={{ width: `${(result.h2hRecord.draws / result.h2hRecord.total) * 100}%` }}>{result.h2hRecord.draws}</span>
                <span className="bg-[var(--brand-accent)]" style={{ width: `${(result.h2hRecord.winsB / result.h2hRecord.total) * 100}%` }}>{result.h2hRecord.winsB}</span>
              </>}
            </div>
            {commonDisciplines.map((code) => (
              <div key={code} className="grid grid-cols-3 rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-xs">
                <span className="font-mono font-bold">{result.shooterA!.disciplines[code].forma?.toFixed(1) ?? "—"}</span>
                <span className="text-center font-semibold">{code}</span>
                <span className="text-right font-mono font-bold">{result.shooterB!.disciplines[code].forma?.toFixed(1) ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
