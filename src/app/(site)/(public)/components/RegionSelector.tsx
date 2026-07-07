"use client";

import { useEffect, useRef, useState } from "react";

// ── Data ───────────────────────────────────────────────────────────────────────

const SRB = { noc: "SRB", alpha2: "RS", name: "Srbija" };

// ── Helpers ────────────────────────────────────────────────────────────────────

type Scope = "issf" | "SRB";

function scopeLabel(scope: Scope): string {
  return scope === "issf" ? "ISSF" : SRB.name;
}

function scopeIcon(scope: Scope): React.ReactNode {
  if (scope === "issf")
    return <img src="/logos/issf.svg" alt="" aria-hidden="true" className="h-4 w-auto max-w-[2rem] object-contain" />;
  return <span className="fi fi-rs" style={{ fontSize: 15, borderRadius: 2 }} aria-hidden="true" />;
}

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "shootermarkt_scope";

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  compact?: boolean;
  placement?: "bottom" | "top";
}

export function RegionSelector({ compact = false, placement = "bottom" }: Props) {
  const [scope, setScope] = useState<Scope>("SRB");
  const [open, setOpen]   = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const s: Scope = (saved === "issf" || saved === "SRB") ? saved : "SRB";
      setScope(s);
      document.cookie = `shootermarkt_scope=${s}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function select(s: Scope) {
    setScope(s);
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, s);
      document.cookie = `shootermarkt_scope=${s}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Opseg: ${scopeLabel(scope)}`}
        className={`flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-colors px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] ${
          open ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]" : ""
        }`}
      >
        {scopeIcon(scope)}
        {!compact && <span className="hidden lg:block">{scopeLabel(scope)}</span>}
        <svg
          width="9" height="9" viewBox="0 0 9 9"
          className={`shrink-0 text-[var(--muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </button>

      {/* Panel */}
      <div
        className={`absolute right-0 w-[13rem] rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_12px_40px_oklch(0_0_0/0.12)] z-[var(--z-dropdown)] overflow-hidden
          transition-[opacity,transform,visibility] duration-150 ease-out
          ${placement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"}
          ${open
            ? "opacity-100 translate-y-0 visible pointer-events-auto"
            : `opacity-0 ${placement === "top" ? "translate-y-2" : "-translate-y-2"} invisible pointer-events-none`
          }`}
      >
        {/* ISSF preset button */}
        <div className="p-2 border-b border-[var(--border)]">
          <button
            onClick={() => select("issf")}
            className={`w-full flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 font-semibold transition-colors ${
              scope === "issf"
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
            }`}
          >
            <span className="flex items-center justify-center h-7 w-full">
              <img src="/logos/issf.svg" alt="" aria-hidden="true" className="h-7 w-auto max-w-[4rem] object-contain" />
            </span>
            <span className="text-[0.65rem] uppercase tracking-widest leading-none">ISSF</span>
          </button>
        </div>

        {/* Serbia row */}
        <button
          onClick={() => select("SRB")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
            scope === "SRB"
              ? "bg-[var(--surface)] text-[var(--brand-primary)]"
              : "text-[var(--ink)] hover:bg-[var(--surface-2)]"
          }`}
        >
          <span className="fi fi-rs shrink-0" style={{ fontSize: 15, borderRadius: 2 }} aria-hidden="true" />
          <span className="flex-1 text-xs font-medium">{SRB.name}</span>
          <span className="text-[0.62rem] font-bold font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] shrink-0">
            {SRB.noc}
          </span>
          {scope === "SRB" && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--brand-primary)]" aria-hidden="true">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
