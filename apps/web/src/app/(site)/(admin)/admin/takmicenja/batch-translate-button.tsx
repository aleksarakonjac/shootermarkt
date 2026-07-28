"use client";

import { useState } from "react";

export function BatchTranslateButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ translated: number; skipped: number; errors: string[]; total: number } | null>(null);

  async function run() {
    setState("loading");
    setResult(null);
    try {
      const res = await fetch("/api/admin/competitions/batch-translate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      setResult(data);
      setState("done");
    } catch (e) {
      setResult({ translated: 0, skipped: 0, errors: [String(e)], total: 0 });
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === "loading"}
        className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === "loading" ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
            Prevodim…
          </span>
        ) : "Prevedi sve →"}
      </button>
      {state === "done" && result && (
        <span className="text-xs text-[var(--muted)]">
          ✓ {result.translated} prevedeno{result.errors.length > 0 ? `, ${result.errors.length} grešaka` : ""}
        </span>
      )}
      {state === "error" && result && (
        <span className="text-xs text-red-500">{result.errors[0]}</span>
      )}
    </div>
  );
}
