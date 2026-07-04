"use client";

import React, { useState, useTransition } from "react";
import { compareShooters, ComparisonResult } from "./actions";

interface ShooterListItem {
  id: number;
  firstName: string;
  lastName: string;
  clubName: string | null;
  nationality: string | null;
}

interface QuickH2HClientProps {
  shootersList: ShooterListItem[];
}

export function QuickH2HClient({ shootersList }: QuickH2HClientProps) {
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCompare = (a: string, b: string) => {
    if (!a || !b) {
      setResult(null);
      return;
    }
    startTransition(async () => {
      try {
        const res = await compareShooters(parseInt(a), parseInt(b));
        setResult(res);
      } catch (err) {
        console.error("Greška pri poređenju:", err);
      }
    });
  };

  const onSelectA = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setIdA(val);
    handleCompare(val, idB);
  };

  const onSelectB = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setIdB(val);
    handleCompare(idA, val);
  };

  // Find common disciplines
  const commonDisciplines =
    result?.shooterA && result?.shooterB
      ? Object.keys(result.shooterA.disciplines).filter((code) =>
          result.shooterB!.disciplines.hasOwnProperty(code)
        )
      : [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--brand-accent)] px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
          Brzi H2H Duel
        </h3>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Dropdowns */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="h2h-shooter-a" className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Strelac A
            </label>
            <select
              id="h2h-shooter-a"
              value={idA}
              onChange={onSelectA}
              className="w-full text-xs rounded border border-[var(--border-strong)] p-1.5 bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="">Izaberi...</option>
              {shootersList
                .filter((s) => s.id.toString() !== idB)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName} {s.firstName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="h2h-shooter-b" className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Strelac B
            </label>
            <select
              id="h2h-shooter-b"
              value={idB}
              onChange={onSelectB}
              className="w-full text-xs rounded border border-[var(--border-strong)] p-1.5 bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="">Izaberi...</option>
              {shootersList
                .filter((s) => s.id.toString() !== idA)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName} {s.firstName}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Loading state */}
        {isPending && (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <div className="w-6 height-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-[var(--muted)]">Računam statistiku...</p>
          </div>
        )}

        {/* Initial Empty state */}
        {!isPending && !result && (
          <div className="py-10 text-center rounded border border-dashed border-[var(--border)] bg-[var(--surface)]">
            <p className="text-xs text-[var(--muted)]" style={{ maxWidth: "25ch", margin: "0 auto" }}>
              Izaberi dva strelca iznad za direktno poređenje njihovih rezultata.
            </p>
          </div>
        )}

        {/* Result comparison */}
        {!isPending && result && result.shooterA && result.shooterB && (
          <div className="flex flex-col gap-4">
            {/* Duel Scorebar (wins A vs B) */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--subtle)]">
                Međusobni skor
              </span>
              <div className="w-full flex items-stretch h-6 rounded overflow-hidden text-xs font-bold text-white font-mono text-center">
                {result.h2hRecord.total === 0 ? (
                  <div className="w-full bg-[var(--surface)] text-[var(--muted)] flex items-center justify-center font-sans font-medium text-[10px]">
                    Nema zajedničkih mečeva
                  </div>
                ) : (
                  <>
                    <div
                      className="bg-[var(--brand-primary)] flex items-center justify-center"
                      style={{
                        width: `${Math.max(15, (result.h2hRecord.winsA / result.h2hRecord.total) * 100)}%`,
                      }}
                      title={`Pobede Strelca A: ${result.h2hRecord.winsA}`}
                    >
                      {result.h2hRecord.winsA}
                    </div>
                    {result.h2hRecord.draws > 0 && (
                      <div
                        className="bg-[var(--subtle)] flex items-center justify-center"
                        style={{
                          width: `${Math.max(10, (result.h2hRecord.draws / result.h2hRecord.total) * 100)}%`,
                        }}
                        title={`Nerešeno: ${result.h2hRecord.draws}`}
                      >
                        {result.h2hRecord.draws}
                      </div>
                    )}
                    <div
                      className="bg-[var(--brand-accent)] flex items-center justify-center"
                      style={{
                        width: `${Math.max(15, (result.h2hRecord.winsB / result.h2hRecord.total) * 100)}%`,
                      }}
                      title={`Pobede Strelca B: ${result.h2hRecord.winsB}`}
                    >
                      {result.h2hRecord.winsB}
                    </div>
                  </>
                )}
              </div>
              {result.h2hRecord.total > 0 && (
                <span className="text-[9px] text-[var(--muted)]">
                  Ukupno mečeva: {result.h2hRecord.total}
                </span>
              )}
            </div>

            {/* Direct Metrics */}
            <div className="flex flex-col gap-2">
              {commonDisciplines.length === 0 ? (
                <div className="text-center py-2 text-xs text-[var(--muted)]">
                  Strelci nemaju zajedničkih disciplina u bazi.
                </div>
              ) : (
                commonDisciplines.map((code) => {
                  const statsA = result.shooterA!.disciplines[code];
                  const statsB = result.shooterB!.disciplines[code];

                  return (
                    <div key={code} className="border border-[var(--border)] rounded p-2 bg-[var(--surface)]">
                      <div className="text-center font-bold text-xs uppercase tracking-wider text-[var(--ink)] mb-2">
                        {code}
                      </div>
                      
                      {/* Forma comparison */}
                      <div className="grid grid-cols-3 items-center text-xs mb-1">
                        <div className="text-left font-mono font-bold text-[var(--ink)]">
                          {statsA.forma ? statsA.forma.toFixed(1) : "—"}
                        </div>
                        <div className="text-center text-[10px] text-[var(--muted)] font-medium">Forma</div>
                        <div className="text-right font-mono font-bold text-[var(--ink)]">
                          {statsB.forma ? statsB.forma.toFixed(1) : "—"}
                        </div>
                      </div>

                      {/* Peak comparison */}
                      <div className="grid grid-cols-3 items-center text-xs">
                        <div className="text-left font-mono text-[var(--muted)]">
                          {statsA.peak ? statsA.peak.toFixed(code.startsWith("AP") ? 0 : 1) : "—"}
                        </div>
                        <div className="text-center text-[10px] text-[var(--muted)] font-medium">Peak</div>
                        <div className="text-right font-mono text-[var(--muted)]">
                          {statsB.peak ? statsB.peak.toFixed(code.startsWith("AP") ? 0 : 1) : "—"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
