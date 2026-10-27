"use client";

export function TodayAnchor() {
  return (
    <button
      type="button"
      onClick={() => document.getElementById("danas")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      title="Idi na današnji datum"
      aria-label="Idi na današnji datum"
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-3 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors sm:py-1.5"
    >
      <span aria-hidden="true">⚓</span> Danas
    </button>
  );
}
