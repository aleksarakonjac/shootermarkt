"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { NocDropdown } from "@/components/ui/NocDropdown";
import { GenderDropdown } from "@/components/ui/GenderDropdown";
import { SearchDropdown } from "@/components/ui/SearchDropdown";

interface ShooterData {
  id: number;
  firstName: string;
  lastName: string;
  nationality: string;
  countryName: string | null;
  gender: string;
  birthYear: number | null;
  birthDate: string | null;
  clubId: number | null;
  clubName: string | null;
  issfId: string | null;
  avatarUrl: string | null;
  apparatus: string | null;
  verified: boolean;
  createdBySelf: boolean;
}

interface Club { id: number; name: string }

interface Result {
  id: number;
  competitionName: string;
  competitionDate: string;
  disciplineCode: string;
  qualTotal: number | null;
  qualRank: number | null;
  finalRank: number | null;
}

interface Props {
  shooter: ShooterData;
  clubs: Club[];
  results: Result[];
}

const DISCIPLINE_COLORS: Record<string, { fg: string; bg: string }> = {
  ARM: { fg: "oklch(0.38 0.16 250)", bg: "oklch(0.93 0.04 250)" },
  ARW: { fg: "oklch(0.42 0.16 320)", bg: "oklch(0.93 0.04 320)" },
  APM: { fg: "oklch(0.36 0.14 150)", bg: "oklch(0.93 0.04 150)" },
  APW: { fg: "oklch(0.48 0.16 30)",  bg: "oklch(0.93 0.04 30)"  },
};
const DEFAULT_DISCIPLINE = { fg: "var(--muted)", bg: "var(--surface-2)" };

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function ShooterAdminClient({ shooter, clubs: initialClubs, results }: Props) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [verifying, startVerifying] = useTransition();
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [clubs, setClubs] = useState(initialClubs);

  useEffect(() => {
    if (!flash || flash.type === "err") return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const [form, setForm] = useState({
    firstName: shooter.firstName,
    lastName: shooter.lastName,
    nationality: shooter.nationality,
    gender: shooter.gender,
    birthDate: shooter.birthDate ?? "",
    clubId: shooter.clubId ? String(shooter.clubId) : "",
  });

  const initials = `${shooter.firstName[0] ?? "?"}${shooter.lastName[0] ?? "?"}`;
  const dirty =
    form.firstName !== shooter.firstName ||
    form.lastName !== shooter.lastName ||
    form.nationality !== shooter.nationality ||
    form.gender !== shooter.gender ||
    form.birthDate !== (shooter.birthDate ?? "") ||
    form.clubId !== (shooter.clubId ? String(shooter.clubId) : "");

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function createClub(name: string) {
    const res = await fetch("/api/admin/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Greška");
    setClubs((prev) => [...prev, { id: data.id, name: data.name }]);
    setField("clubId", String(data.id));
  }

  const clubOptions = clubs.map((c) => ({ value: String(c.id), label: c.name }));

  function save() {
    startSaving(async () => {
      const res = await fetch(`/api/admin/shooters/${shooter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          nationality: form.nationality || null,
          gender: form.gender || null,
          birthDate: form.birthDate || null,
          clubId: form.clubId ? parseInt(form.clubId) : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFlash({ type: "err", msg: d.error ?? "Greška" });
      } else {
        setFlash({ type: "ok", msg: "Sačuvano" });
        router.refresh();
      }
    });
  }

  function verify() {
    startVerifying(async () => {
      await fetch(`/api/admin/shooters/${shooter.id}/verify`, { method: "POST" });
      router.refresh();
    });
  }

  function del() {
    if (!confirm(`Obriši strelca "${shooter.lastName} ${shooter.firstName}"? Ova akcija je nepovratna.`)) return;
    startDeleting(async () => {
      const res = await fetch(`/api/admin/shooters/${shooter.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) {
        setFlash({ type: "err", msg: d.error ?? "Greška" });
      } else {
        router.push("/admin/strelci");
      }
    });
  }

  const anyBusy = saving || deleting || verifying;

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <nav className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <a href="/admin/strelci" className="hover:text-[var(--ink)] transition-colors">
            ← Strelci
          </a>
          <span className="text-[var(--subtle)]">/</span>
          <span className="text-[var(--ink)] font-semibold">
            {shooter.lastName} {shooter.firstName}
          </span>
        </nav>
        <div className="flex items-center gap-2">
          {!shooter.verified && (
            <button
              onClick={verify}
              disabled={anyBusy}
              className="rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              {verifying ? "Verifikujem..." : "Verifikuj"}
            </button>
          )}
          <button
            onClick={del}
            disabled={anyBusy}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? "Brišem..." : "Obriši"}
          </button>
        </div>
      </div>

      {/* Flash */}
      {flash && (
        <div
          className="mb-5 rounded-lg border px-4 py-3 text-sm flex items-center gap-3"
          style={{
            borderColor: flash.type === "ok" ? "var(--border)" : "oklch(0.85 0.12 25)",
            background: flash.type === "ok" ? "var(--surface)" : "oklch(0.97 0.04 25)",
            color: flash.type === "ok" ? "var(--success)" : "oklch(0.45 0.18 25)",
          }}
        >
          <span className="font-semibold">{flash.msg}</span>
          <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity text-base leading-none">×</button>
        </div>
      )}

      {/* Profile header */}
      <div className="flex items-start gap-4 mb-8 pb-6 border-b border-[var(--border)]">
        {shooter.avatarUrl ? (
          <img
            src={shooter.avatarUrl}
            alt={`${shooter.firstName} ${shooter.lastName}`}
            loading="lazy"
            className="h-[144px] w-auto max-w-[108px] rounded-xl object-cover shrink-0"
          />
        ) : (
          <div
            className="h-[144px] w-[96px] rounded-xl flex items-center justify-center shrink-0 font-[family-name:var(--font-barlow-condensed)] font-bold text-3xl tracking-tight text-white select-none"
            style={{ background: "var(--brand-primary)" }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-3">
            <h1
              className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
              style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)", letterSpacing: "-0.02em", lineHeight: 1.1 }}
            >
              {shooter.lastName} {shooter.firstName}
            </h1>
            {shooter.verified ? (
              <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>
                ✓ Verifikovan
              </span>
            ) : (
              <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "oklch(0.97 0.05 75)", color: "oklch(0.55 0.15 75)" }}>
                Na čekanju
              </span>
            )}
            {shooter.createdBySelf && (
              <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                self-reg
              </span>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {shooter.nationality && (
              <>
                <dt className="text-[var(--muted)]">Zemlja</dt>
                <dd className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">
                  {shooter.nationality}{shooter.countryName && shooter.countryName !== shooter.nationality ? ` · ${shooter.countryName}` : ""}
                </dd>
              </>
            )}
            {(shooter.birthDate || shooter.birthYear) && (() => {
              const dateStr = shooter.birthDate
                ? shooter.birthDate.split("-").reverse().join(".")
                : String(shooter.birthYear);
              let age: number | null = null;
              if (shooter.birthDate) {
                const today = new Date();
                const dob = new Date(shooter.birthDate);
                age = today.getFullYear() - dob.getFullYear() -
                  (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
              }
              return (
                <>
                  <dt className="text-[var(--muted)]">Datum rođenja</dt>
                  <dd className="text-[var(--ink)]">
                    {dateStr}{age !== null && <span className="text-[var(--muted)] ml-1">({age} god.)</span>}
                  </dd>
                </>
              );
            })()}
            {shooter.apparatus && (
              <>
                <dt className="text-[var(--muted)]">Oružje</dt>
                <dd className="text-[var(--ink)]">
                  {{rifle:"Puška", pistol:"Pištolj", both:"Puška i pištolj", shotgun:"Shotgun"}[shooter.apparatus] ?? shooter.apparatus}
                </dd>
              </>
            )}
            {shooter.gender && (
              <>
                <dt className="text-[var(--muted)]">Pol</dt>
                <dd className="text-[var(--ink)]">{shooter.gender === "M" ? "Muški" : "Ženski"}</dd>
              </>
            )}
            {shooter.clubName && (
              <>
                <dt className="text-[var(--muted)]">Klub</dt>
                <dd className="text-[var(--ink)]">{shooter.clubName}</dd>
              </>
            )}
            {shooter.issfId && (
              <>
                <dt className="text-[var(--muted)]">ISSF ID</dt>
                <dd className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)]">{shooter.issfId}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Edit form */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-4">Podaci</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">Ime <span className="text-red-500">*</span></label>
            <input
              value={form.firstName}
              onChange={field("firstName")}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">Prezime <span className="text-red-500">*</span></label>
            <input
              value={form.lastName}
              onChange={field("lastName")}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">Pol</label>
            <GenderDropdown value={form.gender} onChange={(v) => setField("gender", v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">Datum rođenja</label>
            <DatePicker
              value={form.birthDate}
              onChange={(value) => setField("birthDate", value)}
              max={new Date().toISOString().slice(0, 10)}
              className="font-[family-name:var(--font-jetbrains-mono)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">Nacionalnost (NOC)</label>
            <NocDropdown value={form.nationality} onChange={(v) => setField("nationality", v)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">Klub</label>
            <SearchDropdown
              value={form.clubId}
              onChange={(v) => setField("clubId", v)}
              options={clubOptions}
              placeholder="Izaberi klub..."
              emptyLabel="— Bez kluba —"
              searchPlaceholder="Pretraži klub..."
              onCreateNew={createClub}
              createNewLabel={(q) => `+ Kreiraj "${q}"`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">ISSF ID <span className="font-normal text-[var(--subtle)]">(read-only)</span></label>
            <input
              value={shooter.issfId ?? ""}
              readOnly
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={save}
            disabled={anyBusy || !dirty}
            className="rounded-md px-5 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {saving ? "Čuvam..." : "Sačuvaj izmene"}
          </button>
          {dirty && (
            <button
              onClick={() => setForm({
                firstName: shooter.firstName,
                lastName: shooter.lastName,
                nationality: shooter.nationality,
                gender: shooter.gender,
                birthDate: shooter.birthDate ?? "",
                clubId: shooter.clubId ? String(shooter.clubId) : "",
              })}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Otkaži
            </button>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="border-t border-[var(--border)] pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-4">
          Rezultati
          <span className="ml-2 font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">{results.length}</span>
        </h2>

        {results.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-12 text-center">
            <p className="text-sm text-[var(--muted)]">Nema unešenih rezultata za ovog strelca.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Takmičenje</th>
                  <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Datum</th>
                  <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Disciplina</th>
                  <th className="px-4 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Kval.</th>
                  <th className="px-4 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Rank</th>
                  <th className="px-4 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Finale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--surface)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--ink)] max-w-xs truncate font-medium text-xs">{r.competitionName}</td>
                    <td className="px-4 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">{fmtDate(r.competitionDate)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded font-[family-name:var(--font-jetbrains-mono)]"
                        style={{
                          background: (DISCIPLINE_COLORS[r.disciplineCode] ?? DEFAULT_DISCIPLINE).bg,
                          color: (DISCIPLINE_COLORS[r.disciplineCode] ?? DEFAULT_DISCIPLINE).fg,
                        }}
                      >
                        {r.disciplineCode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)] tabular-nums">
                      {r.qualTotal?.toFixed(1) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] tabular-nums">
                      {r.qualRank ? `#${r.qualRank}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">
                      {r.finalRank ? (
                        <span style={{ color: r.finalRank <= 3 ? "var(--brand-primary)" : "var(--muted)" }}>
                          #{r.finalRank}
                        </span>
                      ) : <span className="text-[var(--subtle)]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
