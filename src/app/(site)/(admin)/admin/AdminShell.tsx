"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminNav } from "./AdminNav";

export function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (nav click)
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = () => setSidebarOpen(false);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [sidebarOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-screen">
        <SidebarInner userEmail={userEmail} />
      </aside>

      {/* ── Mobile sidebar drawer ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{ background: "rgba(0,0,0,0.45)" }}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 ease-out md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Admin navigacija"
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)] shrink-0">
          <Link href="/" className="flex items-baseline gap-0 no-underline" title="Nazad na sajt" onClick={() => setSidebarOpen(false)}>
            <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.1rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">
              Shooter
            </span>
            <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.1rem] uppercase tracking-tight text-[var(--ink)] leading-none">
              markt
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
            aria-label="Zatvori meni"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <AdminNav onNavClick={() => setSidebarOpen(false)} />
        <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
          <p className="text-[0.65rem] text-[var(--subtle)] truncate mb-1">{userEmail}</p>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              ← Nazad na sajt
            </Link>
            <span className="text-[var(--border-strong)]">·</span>
            <form action="/logout" method="post">
              <button type="submit" className="text-xs font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] transition-colors">
                Odjavi se
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-[var(--z-sticky)] h-14 border-b border-[var(--border)] bg-[var(--bg)] flex items-center px-4 sm:px-8 shrink-0 gap-3">
          {/* Hamburger — mobile only */}
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Otvori meni"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2.5 4.5h13M2.5 9h13M2.5 13.5h13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Logo — mobile only (desktop shows in sidebar) */}
          <Link href="/admin" className="flex items-baseline gap-0 no-underline md:hidden">
            <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">
              Shooter
            </span>
            <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1rem] uppercase tracking-tight text-[var(--ink)] leading-none">
              markt
            </span>
            <span className="ml-1.5 inline-flex items-center text-[0.5rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--brand-primary)] text-white leading-none">
              Admin
            </span>
          </Link>

          <Link href="/admin" className="hidden md:block text-sm font-medium text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
            Home
          </Link>

          <div className="flex-1" id="admin-breadcrumb" />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarInner({ userEmail }: { userEmail: string }) {
  return (
    <>
      {/* Logo / identity */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--border)] shrink-0">
        <Link href="/" className="flex items-baseline gap-0 no-underline" title="Nazad na sajt">
          <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.1rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">
            Shooter
          </span>
          <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.1rem] uppercase tracking-tight text-[var(--ink)] leading-none">
            markt
          </span>
        </Link>
        <span className="ml-auto inline-flex min-h-6 items-center text-[0.55rem] font-bold uppercase tracking-widest px-2 py-1 rounded bg-[var(--brand-primary)] text-white leading-none">
          Admin
        </span>
      </div>

      {/* Nav */}
      <AdminNav />

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
        <p className="text-[0.65rem] text-[var(--subtle)] truncate mb-1">{userEmail}</p>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            ← Nazad na sajt
          </Link>
          <span className="text-[var(--border-strong)]">·</span>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-xs font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] transition-colors"
            >
              Odjavi se
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
