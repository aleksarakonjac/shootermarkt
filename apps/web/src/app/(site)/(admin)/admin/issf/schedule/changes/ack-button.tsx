"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AckButton({ competitionId }: { competitionId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)] disabled:opacity-50"
      onClick={() =>
        start(async () => {
          await fetch("/api/admin/issf/schedule/changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitionId }) });
          router.refresh();
        })
      }
    >
      Pregledano
    </button>
  );
}
