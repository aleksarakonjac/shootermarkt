"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const ZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export function TimezoneForm({ competitionId, location }: { competitionId: number; location: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tz, setTz] = useState("");
  const [loc, setLoc] = useState(location ?? "");
  const [err, setErr] = useState<string | null>(null);
  const field = "rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm";
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await fetch("/api/admin/issf/schedule/timezone", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competitionId, timezone: tz, location: loc }),
          });
          if (res.ok) router.refresh();
          else setErr(((await res.json()) as { error?: string }).error ?? "Greška");
        });
      }}
    >
      <input className={field} value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Lokacija (grad)" />
      <input className={field} list={`tz-${competitionId}`} value={tz} onChange={(e) => setTz(e.target.value)} placeholder="npr. Asia/Almaty" required />
      <datalist id={`tz-${competitionId}`}>{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
      <button disabled={pending || !tz} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50">
        {pending ? "Čuvam…" : "Sačuvaj i povuci satnicu"}
      </button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </form>
  );
}
