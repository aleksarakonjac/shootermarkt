import Link from "next/link";
import { NavLinks } from "./nav-links";
import ThemeToggle from "./components/ThemeToggle";
import { HeaderSearch } from "./components/HeaderSearch";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-[200] bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-8">
            <Link href="/" className="flex items-baseline gap-0 shrink-0 no-underline">
              <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.35rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">
                Shooter
              </span>
              <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.35rem] uppercase tracking-tight text-[var(--ink)] leading-none">
                markt
              </span>
            </Link>

            <NavLinks />

            {/* Search bar in header */}
            <HeaderSearch />

            <ThemeToggle />
            <Link
              href="/portal"
              className="shrink-0 rounded-md bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white transition-colors duration-150"
            >
              Moj profil
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-wrap gap-4">
          <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm uppercase tracking-widest text-[var(--subtle)]">
            Shootermarkt
          </span>
          <p className="text-[0.8125rem] text-[var(--muted)]">
            © {new Date().getFullYear()} · Srpsko streljaštvo
          </p>
        </div>
      </footer>
    </>
  );
}
