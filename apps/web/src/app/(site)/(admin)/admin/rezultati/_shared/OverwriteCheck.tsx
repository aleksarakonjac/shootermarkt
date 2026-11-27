"use client";

import { useEffect, useState } from "react";
import type { MixedTeamEntry, ReviewRow, TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import type { ImportDiff } from "@/lib/import-diff";
import { ImportDiffPanel } from "./ImportDiffPanel";

/** Poredi redove za unos sa bazom (posle pauze u kucanju) i upozorava kad bi unos prepisao postojeće rezultate. */
export function OverwriteCheck({ competitionId, rows, teams, teamResults = [] }: { competitionId: number; rows: ReviewRow[]; teams: MixedTeamEntry[]; teamResults?: TeamResultEntry[] }) {
  const body = JSON.stringify({ competitionId, rows: rows.filter((r) => !r.skip), teams: teams.filter((t) => !t.skip), teamResults: teamResults.filter((t) => !t.skip) });
  // Odgovor važi samo za telo zahteva sa kojim je tražen, pa se zastareli nikad ne prikazuje.
  const [checked, setChecked] = useState<{ body: string; diff: ImportDiff | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let diff: ImportDiff | null = null;
      try {
        const res = await fetch("/api/admin/import/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (res.ok) diff = await res.json();
      } catch { /* prikazuje se poruka ispod */ }
      if (!cancelled) setChecked({ body, diff });
    }, 600);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [body]);

  if (checked?.body !== body) return <p className="text-xs text-[var(--muted)]">Poredim sa rezultatima u bazi…</p>;
  if (!checked.diff) return <p className="text-xs" style={{ color: "var(--warning)" }}>Poređenje sa bazom nije uspelo — proveri da unos neće prepisati postojeće rezultate.</p>;
  return (
    <div className="space-y-2">
      {checked.diff.changed > 0 && (
        <p role="alert" className="rounded-lg border px-4 py-3 text-sm font-semibold text-[var(--ink)]" style={{ borderColor: "var(--warning)" }}>
          Već unetih rezultata koji će biti prepisani: {checked.diff.changed}. Ako je ovo drugi meč (drugi dan, memorijal), označi ga kao zaseban meč.
        </p>
      )}
      <ImportDiffPanel diff={checked.diff} />
    </div>
  );
}
