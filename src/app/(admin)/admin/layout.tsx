import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminNav } from "./AdminNav";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-screen">

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
          <span className="ml-auto text-[0.55rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--brand-primary)] text-white leading-none">
            Admin
          </span>
        </div>

        {/* Nav */}
        <AdminNav />

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
          <p className="text-[0.65rem] text-[var(--subtle)] truncate mb-1">{user.email}</p>
          <Link
            href="/"
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            ← Nazad na sajt
          </Link>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-[var(--z-sticky)] h-14 border-b border-[var(--border)] bg-[var(--bg)] flex items-center px-8 shrink-0">
          <div className="flex-1" id="admin-breadcrumb" />
        </header>

        <main className="flex-1 px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
