"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NocDropdown } from "@/components/ui/NocDropdown";
import { DatePicker } from "@/components/ui/DatePicker";
import { GenderDropdown } from "@/components/ui/GenderDropdown";
import { SearchDropdown } from "@/components/ui/SearchDropdown";

interface Club { id: number; name: string; countryCode: string | null; }

const inputCls = "w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]";

export function ShooterFormClient({ clubs: initialClubs }: { clubs: Club[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clubs, setClubs] = useState(initialClubs);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nationality: "SRB",
    gender: "",
    birthDate: "",
    clubId: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function createClub(name: string) {
    const res = await fetch("/api/admin/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Greška");
    setClubs((prev) => [...prev, { id: data.id, name: data.name, countryCode: null }]);
    set("clubId", String(data.id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/shooters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      router.push("/admin/strelci");
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const clubOptions = clubs.map((c) => ({
    value: String(c.id),
    label: c.name,
    sublabel: c.countryCode ?? undefined,
  }));

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Novi strelac
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Ručni unos pojedinačnog strelca</p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Osnovni podaci</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Prezime *</label>
              <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required placeholder="Petrović" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Ime *</label>
              <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required placeholder="Marko" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Zemlja</label>
              <NocDropdown value={form.nationality} onChange={(v) => set("nationality", v)} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Pol</label>
              <GenderDropdown value={form.gender} onChange={(v) => set("gender", v)} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Datum rođenja</label>
              <DatePicker
                value={form.birthDate}
                onChange={(value) => set("birthDate", value)}
                max={new Date().toISOString().slice(0, 10)}
                className="font-[family-name:var(--font-jetbrains-mono)]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Klub</label>
            <SearchDropdown
              value={form.clubId}
              onChange={(v) => set("clubId", v)}
              options={clubOptions}
              placeholder="Izaberi klub..."
              emptyLabel="— bez kluba —"
              searchPlaceholder="Pretraži klub..."
              onCreateNew={createClub}
              createNewLabel={(q) => `+ Kreiraj "${q}"`}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md px-6 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Snimam..." : "Snimi strelca"}
          </button>
          <Link
            href="/admin/strelci"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Otkaži
          </Link>
        </div>
      </form>
    </div>
  );
}
