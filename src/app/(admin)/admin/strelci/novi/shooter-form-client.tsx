"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Club { id: number; name: string; countryCode: string | null; }

const GENDERS = [{ value: "M", label: "Muški" }, { value: "F", label: "Ženski" }];
const NOC_SUGGESTIONS = ["SRB", "CRO", "SLO", "HUN", "GER", "ROU", "BIH", "MKD", "MNE", "BUL"];

export function ShooterFormClient({ clubs }: { clubs: Club[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    nationality: "SRB",
    gender: "",
    birthYear: "",
    licenseNumber: "",
    clubId: "",
    issfId: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
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
              <input
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
                placeholder="Petrović"
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Ime *</label>
              <input
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
                placeholder="Marko"
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Zemlja</label>
              <input
                value={form.nationality}
                onChange={(e) => set("nationality", e.target.value.toUpperCase().slice(0, 3))}
                placeholder="SRB"
                maxLength={3}
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {NOC_SUGGESTIONS.slice(0, 5).map((noc) => (
                  <button key={noc} type="button" onClick={() => set("nationality", noc)}
                    className="rounded px-1.5 py-0.5 text-[0.6rem] font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors"
                    style={{ background: form.nationality === noc ? "var(--brand-primary)" : "var(--surface)", color: form.nationality === noc ? "white" : "var(--muted)" }}>
                    {noc}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Pol</label>
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
              >
                <option value="">—</option>
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">God. rođenja</label>
              <input
                type="number"
                value={form.birthYear}
                onChange={(e) => set("birthYear", e.target.value)}
                placeholder="1995"
                min={1940}
                max={new Date().getFullYear()}
                className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Klub i licenca</h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Klub</label>
            <select
              value={form.clubId}
              onChange={(e) => set("clubId", e.target.value)}
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
            >
              <option value="">— bez kluba —</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.countryCode ? ` (${c.countryCode})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Licencni broj</label>
            <input
              value={form.licenseNumber}
              onChange={(e) => set("licenseNumber", e.target.value)}
              placeholder="npr. 12345"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
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
              placeholder="npr. SHSRBM2703200501"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm font-[family-name:var(--font-jetbrains-mono)] text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)]"
            />
            <p className="text-xs text-[var(--subtle)] mt-1">Opcionalno. Vezuje profil za ISSF bazu.</p>
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
          <a
            href="/admin/strelci"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Otkaži
          </a>
        </div>
      </form>
    </div>
  );
}
