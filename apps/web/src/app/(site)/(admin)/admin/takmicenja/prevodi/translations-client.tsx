"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Row = {
  id: number;
  date: string;
  name: string;
  nameSr: string | null;
  nameEn: string | null;
  location: string | null;
  locationSr: string | null;
  locationEn: string | null;
};

const FIELDS = ["nameSr", "nameEn", "locationSr", "locationEn"] as const;
const isMissing = (r: Row) => !r.nameSr || !r.nameEn || (!!r.location && (!r.locationSr || !r.locationEn));

const input = "w-full rounded border border-[var(--border-strong)] bg-transparent px-2 py-1 text-sm text-[var(--ink)]";

export function TranslationsClient({ year, years, initialRows }: { year: number; years: number[]; initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function translateAll() {
    const todo = rows.filter(isMissing);
    setRunning(true);
    setErrors([]);
    setProgress({ done: 0, total: todo.length });
    for (const [i, r] of todo.entries()) {
      try {
        const res = await fetch(`/api/admin/competitions/${r.id}/translations`, { method: "POST" });
        const data = await res.json();
        update(r.id, data.patch ?? data.partial ?? {});
        if (!res.ok) throw new Error(data.error ?? "Greška");
      } catch (e) {
        setErrors((x) => [...x, `[${r.id}] ${r.name}: ${String(e)}`]);
      }
      setProgress({ done: i + 1, total: todo.length });
    }
    setRunning(false);
  }

  async function save(r: Row) {
    setSaving(r.id);
    try {
      const res = await fetch(`/api/admin/competitions/${r.id}/translations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f, r[f]]))),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Greška");
    } catch (e) {
      setErrors((x) => [...x, `[${r.id}] snimanje: ${String(e)}`]);
    }
    setSaving(null);
  }

  const missing = rows.filter(isMissing).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={year}
          onChange={(e) => router.push(`/admin/takmicenja/prevodi?year=${e.target.value}`)}
          className="rounded-md border border-[var(--border-strong)] bg-transparent px-3 py-2 text-sm font-semibold text-[var(--ink)]"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          onClick={translateAll}
          disabled={running || missing === 0}
          className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? `Prevodim… ${progress?.done}/${progress?.total}` : `Prevedi sve za ${year}`}
        </button>
        <span className="text-xs text-[var(--muted)]">{rows.length} takmičenja, {missing} bez kompletnog prevoda</span>
      </div>

      {errors.length > 0 && (
        <ul className="mb-4 text-xs text-red-500 space-y-0.5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-[var(--border)] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <div className="text-sm text-[var(--ink)]">
                <span className="font-semibold">{r.name}</span>
                {r.location && <span className="text-[var(--muted)]"> · {r.location}</span>}
              </div>
              <span className="text-xs text-[var(--subtle)] tabular-nums">{r.date}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELDS.map((f) => {
                if (f.startsWith("location") && !r.location) return null;
                return (
                  <label key={f} className="block text-xs text-[var(--muted)]">
                    {f.startsWith("name") ? "Naziv" : "Lokacija"} {f.endsWith("Sr") ? "SR" : "EN"}
                    <input
                      value={r[f] ?? ""}
                      onChange={(e) => update(r.id, { [f]: e.target.value })}
                      className={`${input} ${r[f] ? "" : "border-amber-500"}`}
                    />
                  </label>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => save(r)}
                disabled={saving === r.id}
                className="rounded-md border border-[var(--border-strong)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-50"
              >
                {saving === r.id ? "Snimam…" : "Snimi"}
              </button>
              <Link href={`/admin/takmicenja/${r.id}/edit`} className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">Puna izmena →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
