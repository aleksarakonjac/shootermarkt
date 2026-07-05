"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { LevelDropdown } from "@/components/ui/LevelDropdown";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

export function CompetitionFormClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", date: "", location: "", level: "national" as CompetitionLevel, issfId: "" });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      router.push("/admin/takmicenja");
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Novo takmičenje
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Ručni unos takmičenja</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Podaci</h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Naziv *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              placeholder="npr. Državno prvenstvo Srbije 2025"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum *</label>
              <DatePicker
                value={form.date}
                onChange={(value) => set("date", value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Nivo *</label>
              <LevelDropdown value={form.level} onChange={(v) => set("level", v)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Lokacija</label>
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="npr. Beograd, SC Crvena zvezda"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">ISSF</h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">ISSF ID</label>
            <input
              value={form.issfId}
              onChange={(e) => set("issfId", e.target.value)}
              placeholder="npr. 3321"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <p className="text-xs text-[var(--subtle)] mt-1">Opcionalno. Sprečava dupli ISSF import.</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Snimam..." : "Snimi takmičenje"}
          </button>
          <a
            href="/admin/takmicenja"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Otkaži
          </a>
        </div>
      </form>
    </div>
  );
}
