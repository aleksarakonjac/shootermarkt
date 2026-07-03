"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Pagination } from "../components/Pagination";
import { NOC_LIST } from "@/components/ui/NocDropdown";

export interface ShooterRow {
  id: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  countryName: string | null;
  verified: boolean;
  createdBySelf: boolean;
  issfId: string | null;
  clubName: string | null;
  birthDate: string | null;
  birthYear: number | null;
  apparatus: string | null;
  gender: string | null;
}

const APPARATUS_LABELS: Record<string, string> = {
  rifle: "Puška",
  pistol: "Pištolj",
  both: "Puška+Pištolj",
  shotgun: "Shotgun",
};

function calcAge(birthDate: string): number | null {
  const dob = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear() -
    (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  return age;
}

function fmtDate(iso: string): string {
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : iso;
}

type SortCol = "name" | "country" | "gender" | "birthDate" | "apparatus";

export function StrelciClient({ data, page, total, pageSize }: { data: ShooterRow[]; page: number; total: number; pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const sortCol = (params.get("sort") ?? "name") as SortCol;
  const sortDir = params.get("dir") ?? "asc";

  function setSort(col: SortCol) {
    const next = new URLSearchParams(params.toString());
    if (sortCol === col) {
      next.set("dir", sortDir === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", col);
      next.set("dir", "asc");
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }
  const [verifying, startVerifying] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupNats, setCleanupNats] = useState("YUG");
  const [cleaning, startCleaning] = useTransition();

  const [verifyingAll, startVerifyingAll] = useTransition();

  const unverified = data.filter((s) => !s.verified);
  const allUnverifiedSelected = unverified.length > 0 && unverified.every((s) => selected.has(s.id));

  async function verifyAll() {
    if (!confirm("Verifikuj SVE neverifikovane strelce u bazi? Ova akcija se odnosi na sve stranice.")) return;
    startVerifyingAll(async () => {
      const res = await fetch("/api/admin/shooters/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash(`Greška: ${data.error}`);
      } else {
        setFlash(`${data.verified} strelaca verifikovano`);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllUnverified() {
    if (allUnverifiedSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unverified.map((s) => s.id)));
    }
  }

  async function bulkVerify() {
    const ids = [...selected];
    startVerifying(async () => {
      const res = await fetch("/api/admin/shooters/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash(`Greška: ${data.error}`);
      } else {
        setFlash(`${data.verified} strelaca verifikovano`);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  async function deleteSingle(id: number, name: string) {
    if (!confirm(`Obriši strelca "${name}"?`)) return;
    startVerifying(async () => {
      const res = await fetch(`/api/admin/shooters/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setFlash(`Greška: ${data.error}`);
      } else {
        router.refresh();
      }
    });
  }

  async function verifySingle(id: number) {
    startVerifying(async () => {
      await fetch(`/api/admin/shooters/${id}/verify`, { method: "POST" });
      router.refresh();
    });
  }

  const selectedUnverified = [...selected].filter((id) => {
    const s = data.find((r) => r.id === id);
    return s && !s.verified;
  });

  return (
    <div>
      {/* Flash */}
      {flash && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm flex items-center gap-3">
          <span style={{ color: "var(--success)" }} className="font-semibold">{flash}</span>
          <button onClick={() => setFlash(null)} className="ml-auto text-[var(--subtle)] hover:text-[var(--ink)] transition-colors">×</button>
        </div>
      )}

      {/* Verify all */}
      {unverified.length > 0 && selectedUnverified.length === 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={verifyAll}
            disabled={verifyingAll}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
          >
            {verifyingAll ? "Verifikujem sve..." : "Verifikuj sve"}
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedUnverified.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)]">{selectedUnverified.length}</span> selektovano
          </span>
          <button
            onClick={bulkVerify}
            disabled={verifying}
            className="ml-auto rounded-md px-4 py-1.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            {verifying ? "Verifikujem..." : `Verifikuj ${selectedUnverified.length}`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            Otkaži
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {data.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">
            Nema strelaca. <Link href="/admin/strelci/novi" className="text-[var(--brand-primary)] hover:underline">Dodaj prvog →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-4 py-3 w-8">
                  {unverified.length > 0 && (
                    <input
                      type="checkbox"
                      checked={allUnverifiedSelected}
                      onChange={toggleAllUnverified}
                      className="accent-[var(--brand-primary)] cursor-pointer"
                      title="Selektuj sve neverifikovane"
                    />
                  )}
                </th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none hover:text-[var(--ink)] transition-colors" onClick={() => setSort("name")}>
                  Strelac<SortIcon col="name" />
                </th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none hover:text-[var(--ink)] transition-colors" onClick={() => setSort("country")}>
                  Zemlja<SortIcon col="country" />
                </th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none hover:text-[var(--ink)] transition-colors" onClick={() => setSort("gender")}>
                  Pol<SortIcon col="gender" />
                </th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none hover:text-[var(--ink)] transition-colors" onClick={() => setSort("birthDate")}>
                  Datum rođ.<SortIcon col="birthDate" />
                </th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] cursor-pointer select-none hover:text-[var(--ink)] transition-colors" onClick={() => setSort("apparatus")}>
                  Disciplina<SortIcon col="apparatus" />
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-[var(--surface)] transition-colors"
                  style={selected.has(s.id) ? { background: "var(--surface)" } : undefined}
                >
                  <td className="px-4 py-3">
                    {!s.verified && (
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="accent-[var(--brand-primary)] cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">
                    <a href={`/admin/strelci/${s.id}`} className="hover:text-[var(--brand-primary)] transition-colors">
                      {s.lastName} {s.firstName}
                    </a>
                    {s.createdBySelf && (
                      <span className="ml-2 text-[0.65rem] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>
                        self
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.nationality ? (
                      <span className="flex items-center gap-1.5">
                        {(() => {
                          const alpha2 = NOC_LIST.find((n) => n.noc === s.nationality)?.alpha2;
                          return alpha2 ? (
                            <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ fontSize: "1em", borderRadius: "2px", flexShrink: 0 }} />
                          ) : null;
                        })()}
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">{s.nationality}</span>
                        {s.countryName && s.countryName !== s.nationality && (
                          <span className="text-[0.65rem] text-[var(--muted)] truncate max-w-[100px]">{s.countryName}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--subtle)] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{s.clubName ?? <span className="text-[var(--subtle)]">—</span>}</td>
                  <td className="px-4 py-3 text-xs font-bold">
                    {s.gender === "M" ? (
                      <span style={{ color: "oklch(0.52 0.18 250)" }}>M</span>
                    ) : s.gender === "F" ? (
                      <span style={{ color: "oklch(0.55 0.18 350)" }}>Ž</span>
                    ) : (
                      <span className="text-[var(--subtle)] font-normal">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--ink)] whitespace-nowrap">
                    {s.birthDate ? (
                      <>
                        <span className="font-[family-name:var(--font-jetbrains-mono)]">{fmtDate(s.birthDate)}</span>
                        <span className="text-[var(--muted)] ml-1">({calcAge(s.birthDate)} g.)</span>
                      </>
                    ) : s.birthYear ? (
                      <span className="text-[var(--muted)]">{s.birthYear}</span>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--ink)]">
                    {s.apparatus ? (
                      <span className="text-[var(--muted)]">{APPARATUS_LABELS[s.apparatus] ?? s.apparatus}</span>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {!s.verified && (
                        <button
                          onClick={() => verifySingle(s.id)}
                          disabled={verifying}
                          className="text-xs font-semibold text-[var(--brand-primary)] hover:underline disabled:opacity-50"
                        >
                          Verifikuj
                        </button>
                      )}
                      <button
                        onClick={() => deleteSingle(s.id, `${s.lastName} ${s.firstName}`)}
                        disabled={verifying}
                        className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
                      >
                        Obriši
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} total={total} pageSize={pageSize} />
      </div>
    </div>
  );
}
