"use client";

import React, { useState, useTransition } from "react";
import { compareShooters, ComparisonResult } from "./actions";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("home");
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");

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

  const onChangeA = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchA(e.target.value);
    setIdA("");
  };

  const onChangeB = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchB(e.target.value);
    setIdB("");
  };

  const selectShooterA = (shooter: ShooterListItem) => {
    setIdA(String(shooter.id));
    setSearchA(`${shooter.lastName} ${shooter.firstName}`);
    handleCompare(String(shooter.id), idB);
  };

  const selectShooterB = (shooter: ShooterListItem) => {
    setIdB(String(shooter.id));
    setSearchB(`${shooter.lastName} ${shooter.firstName}`);
    handleCompare(idA, String(shooter.id));
  };

  const filteredA = shootersList
    .filter((s) => s.id.toString() !== idB)
    .filter((s) =>
      `${s.lastName} ${s.firstName}`.toLowerCase().includes(searchA.toLowerCase())
    );

  const filteredB = shootersList
    .filter((s) => s.id.toString() !== idA)
    .filter((s) =>
      `${s.lastName} ${s.firstName}`.toLowerCase().includes(searchB.toLowerCase())
    );

  const commonDisciplines =
    result?.shooterA && result?.shooterB
      ? Object.keys(result.shooterA.disciplines).filter((code) =>
          result.shooterB!.disciplines.hasOwnProperty(code)
        )
      : [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--brand-primary)] px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
          {t("h2hTitle")}
        </h3>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Shooter selectors */}
        <div className="grid grid-cols-2 gap-2">
          {/* Shooter A */}
          <div className="flex flex-col gap-1">
            <label htmlFor="h2h-shooter-a" className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Strelac A
            </label>
            <div className="relative">
              <input
                id="h2h-shooter-a"
                value={searchA}
                onChange={onChangeA}
                placeholder="Pretraži..."
                className="w-full text-xs rounded border border-[var(--border-strong)] p-1.5 bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
                autoComplete="off"
              />
              {searchA && !idA && filteredA.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg max-h-48 overflow-y-auto">
                  {filteredA.map((s) => (
                    <li
                      key={s.id}
                      onClick={() => selectShooterA(s)}
                      className="px-2 py-1 text-xs cursor-pointer hover:bg-[var(--surface)]"
                    >
                      {s.lastName} {s.firstName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Shooter B */}
          <div className="flex flex-col gap-1">
            <label htmlFor="h2h-shooter-b" className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Strelac B
            </label>
            <div className="relative">
              <input
                id="h2h-shooter-b"
                value={searchB}
                onChange={onChangeB}
                placeholder="Pretraži..."
                className="w-full text-xs rounded border border-[var(--border-strong)] p-1.5 bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)]"
                autoComplete="off"
              />
              {searchB && !idB && filteredB.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg max-h-48 overflow-y-auto">
                  {filteredB.map((s) => (
                    <li
                      key={s.id}
                      onClick={() => selectShooterB(s)}
                      className="px-2 py-1 text-xs cursor-pointer hover:bg-[var(--surface)]"
                    >
                      {s.lastName} {s.firstName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isPending && (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[var(--muted)]">Računam statistiku...</p>
          </div>
        )}

        {/* Empty state */}
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
            {/* Duel Scorebar */}
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
                      style={{ width: `${Math.max(15, (result.h2hRecord.winsA / result.h2hRecord.total) * 100)}%` }}
                      title={`Pobede Strelca A: ${result.h2hRecord.winsA}`}
                    >
                      {result.h2hRecord.winsA}
                    </div>
                    {result.h2hRecord.draws > 0 && (
                      <div
                        className="bg-[var(--subtle)] flex items-center justify-center"
                        style={{ width: `${Math.max(10, (result.h2hRecord.draws / result.h2hRecord.total) * 100)}%` }}
                        title={`Nerešeno: ${result.h2hRecord.draws}`}
                      >
                        {result.h2hRecord.draws}
                      </div>
                    )}
                    <div
                      className="bg-[var(--brand-accent)] flex items-center justify-center"
                      style={{ width: `${Math.max(15, (result.h2hRecord.winsB / result.h2hRecord.total) * 100)}%` }}
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
                      {/* Forma */}
                      <div className="grid grid-cols-3 items-center text-xs mb-1">
                        <div className="text-left font-mono font-bold text-[var(--ink)]">
                          {statsA.forma ? statsA.forma.toFixed(1) : "—"}
                        </div>
                        <div className="text-center text-[10px] text-[var(--muted)] font-medium">Forma</div>
                        <div className="text-right font-mono font-bold text-[var(--ink)]">
                          {statsB.forma ? statsB.forma.toFixed(1) : "—"}
                        </div>
                      </div>
                      {/* Peak */}
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
