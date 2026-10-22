"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const LABEL: Record<string, string> = { empty: "satnica još nije objavljena", no_tz: "nema zonu", first: "prvi upis", unchanged: "bez izmena", updated: "izmenjeno", error: "greška pri preuzimanju" };

export function SyncNowButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [out, setOut] = useState<string[] | null>(null);
  return (
    <div className="mb-6">
      <button
        disabled={pending}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"
        onClick={() =>
          start(async () => {
            const res = await fetch("/api/admin/issf/schedule/sync", { method: "POST" });
            const data = await res.json() as { results?: { competitionId: number; status: string; changes: number }[]; error?: string };
            setOut(data.results ? data.results.map((r) => `#${r.competitionId}: ${LABEL[r.status] ?? r.status}${r.changes ? ` (${r.changes})` : ""}`) : [data.error ?? "Greška"]);
            router.refresh();
          })
        }
      >
        {pending ? "Sinhronizujem…" : "Sinhronizuj satnicu sada"}
      </button>
      {out && <p className="mt-2 text-sm text-[var(--muted)]">{out.length ? out.join(" · ") : "Nema takmičenja u opsegu."}</p>}
    </div>
  );
}
