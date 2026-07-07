"use client";

import { useState, useCallback } from "react";

interface Props {
  sourceName: string;
  from: "sr" | "en";
  to: "sr" | "en";
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}

export function TranslatedNameInput({
  sourceName,
  from,
  to,
  value,
  onChange,
  label,
  placeholder,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(async () => {
    if (!sourceName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/translate-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceName.trim(), from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Greška");
      onChange(data.translated);
      setIsAuto(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [sourceName, from, to, onChange]);

  function handleChange(v: string) {
    setIsAuto(false);
    onChange(v);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {isAuto && !loading && (
            <span className="text-[0.6rem] font-bold uppercase tracking-widest font-[family-name:var(--font-jetbrains-mono)] text-[var(--brand-primary)] opacity-70">
              auto
            </span>
          )}
          {error && (
            <span className="text-[0.65rem] text-red-500">{error}</span>
          )}
          <button
            type="button"
            onClick={translate}
            disabled={loading || !sourceName.trim()}
            className="flex items-center gap-1 text-[0.65rem] font-semibold px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-[var(--muted)] border-t-transparent animate-spin" />
                Prevodi…
              </>
            ) : (
              <>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M1 3h5M3 1v2M1 3c0 2 1.5 3.5 3 4M6 3c-.5 2-2 3.5-3 4M7 6h4M9 4v7M11 6l-2-2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Prevedi
              </>
            )}
          </button>
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] bg-[var(--bg)] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)]"
      />
    </div>
  );
}
