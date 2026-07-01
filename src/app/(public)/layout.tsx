import Link from "next/link";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MainNav } from "./components/MainNav";
import { SearchBarClient } from "./search-bar-client";
import ThemeToggle from "./components/ThemeToggle";
import { RegionSelector } from "./components/RegionSelector";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shootersList = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      clubName: clubs.name,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(eq(shooters.verified, true))
    .orderBy(shooters.lastName, shooters.firstName);

  return (
    <>
      <header className="sticky top-0 z-[200] bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-4">

            {/* Logo */}
            <Link href="/" className="flex items-baseline gap-0 shrink-0 no-underline">
              <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.35rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">
                Shooter
              </span>
              <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.35rem] uppercase tracking-tight text-[var(--ink)] leading-none">
                markt
              </span>
            </Link>

            {/* Main nav — dropdown groups on desktop, hamburger + drawer on mobile */}
            <div className="flex-1 flex items-center">
              <MainNav shootersList={shootersList} />
            </div>

            {/* Desktop right controls */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <RegionSelector />
              <div className="w-48 lg:w-56">
                <SearchBarClient shootersList={shootersList} />
              </div>
              <ThemeToggle />
            </div>

          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="flex items-baseline gap-0 no-underline">
            <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm uppercase tracking-widest text-[var(--subtle)]">
              Shooter
            </span>
            <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-sm uppercase tracking-widest text-[var(--subtle)]">
              markt
            </span>
          </Link>
          <p className="text-[0.8125rem] text-[var(--muted)]">
            © {new Date().getFullYear()} · Srpsko streljaštvo
          </p>
        </div>
      </footer>
    </>
  );
}
