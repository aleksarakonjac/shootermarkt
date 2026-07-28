"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminNav } from "./AdminNav";

export function AdminMobileHeader({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      {/* Mobile top bar — hidden on md+ where sidebar is visible */}
      <div className="md:hidden sticky top-0 z-[var(--z-sticky)] flex items-center gap-2 h-14 px-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <button
          onClick={() => setOpen(true)}
          aria-label="Otvori meni"
          className="flex items-center justify-center w-10 h-10 -ml-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
            <rect width="18" height="1.5" rx="0.75" fill="currentColor"/>
            <rect y="6.25" width="18" height="1.5" rx="0.75" fill="currentColor"/>
            <rect y="12.5" width="18" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
        </button>

        <Link href="/admin" className="flex items-baseline gap-0 no-underline">
          <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.1rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">Shooter</span>
          <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.1rem] uppercase tracking-tight text-[var(--ink)] leading-none">markt</span>
        </Link>
        <span className="inline-flex items-center text-[0.55rem] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[var(--brand-primary)] text-white leading-none">Admin</span>
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-[var(--z-modal-bd)] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 inset-y-0 w-64 flex flex-col bg-[var(--surface)] border-r border-[var(--border)] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border)] shrink-0">
              <Link href="/" className="flex items-baseline gap-0 no-underline" title="Nazad na sajt">
                <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.1rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">Shooter</span>
                <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.1rem] uppercase tracking-tight text-[var(--ink)] leading-none">markt</span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Zatvori meni"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Nav */}
            <AdminNav />

            {/* Footer */}
            <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
              <p className="text-[0.65rem] text-[var(--subtle)] truncate mb-1">{email}</p>
              <div className="flex items-center gap-2">
                <Link href="/" className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">← Nazad na sajt</Link>
                <span className="text-[var(--border-strong)]">·</span>
                <form action="/logout" method="post">
                  <button type="submit" className="text-xs font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] transition-colors">
                    Odjavi se
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
