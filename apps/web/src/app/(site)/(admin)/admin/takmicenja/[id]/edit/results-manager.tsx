"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CompetitionResultGroup } from "@/app/api/admin/competitions/[id]/results/route";

const CATEGORY_LABELS: Record<string, string> = {
  senior: "Seniori", junior: "Juniori", youth_junior: "Mlađi juniori", cadet: "Kadeti", u23: "U23",
};

const groupKey = (g: CompetitionResultGroup) => `${g.kind}|${g.disciplineId}|${g.eventId ?? ""}|${g.category}`;

export function ResultsManager({ competitionId }: { competitionId: number }) {
  const router = useRouter();
  const [groups, setGroups] = useState<CompetitionResultGroup[] | null>(null);
  const [pending, setPending] = useState<{ scope: "group" | "discipline"; group: CompetitionResultGroup } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/competitions/${competitionId}/results`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Greška");
      setGroups(json.groups);
    } catch (e) {
      setError(String(e));
    }
  }, [competitionId]);

  useEffect(() => { void load(); }, [load]);

  async function confirmDelete() {
    if (!pending) return;
    const { scope, group } = pending;
    setBusy(true);
    setError(null);
    try {
      const body = scope === "discipline"
        ? { kind: group.kind, disciplineId: group.disciplineId }
        : { kind: group.kind, disciplineId: group.disciplineId, eventId: group.eventId, category: group.category };
      const res = await fetch(`/api/admin/competitions/${competitionId}/results`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Greška pri brisanju");
      setPending(null);
      await load();
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const disciplineTotal = (g: CompetitionResultGroup) =>
    (groups ?? []).filter((x) => x.kind === g.kind && x.disciplineId === g.disciplineId).reduce((s, x) => s + x.count, 0);

  // Jedan red po disciplini; ispod njega mečevi/kategorije.
  const byDiscipline = new Map<string, CompetitionResultGroup[]>();
  for (const g of groups ?? []) {
    const k = `${g.kind}|${g.disciplineId}`;
    byDiscipline.set(k, [...(byDiscipline.get(k) ?? []), g]);
  }

  return (
    <div className="mt-8 rounded-xl border border-[var(--border)] p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Rezultati</h2>
      <p className="text-xs text-[var(--muted)] mb-4">Briši rezultate cele discipline ili samo jednog meča/kategorije. Takmičenje i ostale discipline ostaju.</p>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {groups === null && !error && <p className="text-sm text-[var(--muted)]">Učitavam…</p>}
      {groups?.length === 0 && <p className="text-sm text-[var(--muted)]">Nema rezultata.</p>}

      <div className="space-y-3">
        {[...byDiscipline.entries()].map(([k, list]) => {
          const first = list[0];
          return (
            <div key={k} className="rounded-lg border border-[var(--border)]">
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[var(--surface-2)] rounded-t-lg">
                <div className="text-sm font-semibold text-[var(--ink)]">
                  {first.code} <span className="font-normal text-[var(--muted)]">· {first.disciplineName} · {disciplineTotal(first)} rez.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPending({ scope: "discipline", group: first })}
                  className="shrink-0 rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  Obriši disciplinu
                </button>
              </div>
              {list.length > 1 || first.eventName || first.category !== "senior" ? (
                <ul className="divide-y divide-[var(--border)]">
                  {list.map((g) => (
                    <li key={groupKey(g)} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                      <span className="text-[var(--ink)]">
                        {g.eventName ?? "Glavni meč"}{g.eventDate ? ` (${g.eventDate})` : ""} · {CATEGORY_LABELS[g.category] ?? g.category}
                        {g.kind === "mixed" ? " · tim" : ""}
                        <span className="text-[var(--muted)]"> · {g.count}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPending({ scope: "group", group: g })}
                        className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                      >
                        Obriši
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>

      {pending && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-[var(--ink)] mb-3">
            {pending.scope === "discipline"
              ? <>Obrisati <strong>sve rezultate discipline {pending.group.code}</strong> ({disciplineTotal(pending.group)}) iz ovog takmičenja?</>
              : <>Obrisati <strong>{pending.group.count} rezultata</strong> ({pending.group.code}, {pending.group.eventName ?? "glavni meč"}, {CATEGORY_LABELS[pending.group.category] ?? pending.group.category})?</>}
            {" "}Ovo se ne može poništiti.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {busy ? "Brišem..." : "Da, obriši"}
            </button>
            <button type="button" onClick={() => setPending(null)} disabled={busy} className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              Otkaži
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
