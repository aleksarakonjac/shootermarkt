"use client";

interface CommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId?: number;
}

interface Props {
  result: CommitResult;
  onReset: () => void;
  resetLabel?: string;
}

export function DonePanel({ result, onReset, resetLabel = "Unesi još" }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] p-8 text-center">
        <div
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold leading-none mb-2"
          style={{ fontSize: "clamp(3rem, 8vw, 5rem)", color: "var(--success)" }}
        >
          {result.inserted}
        </div>
        <p className="text-sm text-[var(--muted)]">
          rezultata uneto
          {result.skipped > 0 && ` · ${result.skipped} preskočeno`}
        </p>
        {result.errors.length > 0 && (
          <div className="mt-4 text-left rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1 dark:bg-red-950 dark:border-red-900 dark:text-red-300">
            <p className="font-semibold mb-1">Greške:</p>
            {result.errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="rounded-md px-5 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors"
        >
          {resetLabel}
        </button>
        {result.competitionId && (
          <a
            href={`/takmicenja/${result.competitionId}`}
            target="_blank"
            className="rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Vidi takmičenje →
          </a>
        )}
        <a
          href="/admin"
          className="rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
        >
          Admin panel
        </a>
      </div>
    </div>
  );
}
