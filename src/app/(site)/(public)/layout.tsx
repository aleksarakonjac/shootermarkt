import Link from "next/link";
import { db } from "@/lib/db";
import { shooters, clubs, competitions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { MainNav } from "./components/MainNav";
import { GlobalSearch } from "./GlobalSearch";
import ThemeToggle from "./components/ThemeToggle";
import { RegionSelector } from "./components/RegionSelector";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shootersList, competitionsList] = await Promise.all([
    db
      .select({
        id: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        clubName: clubs.name,
        avatarUrl: shooters.avatarUrl,
      })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(eq(shooters.verified, true))
      .orderBy(shooters.lastName, shooters.firstName),

    db
      .select({
        id: competitions.id,
        name: competitions.name,
        date: competitions.date,
        level: competitions.level,
      })
      .from(competitions)
      .orderBy(desc(competitions.date))
      .limit(500),
  ]);

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

            {/* Nav groups (desktop) + hamburger (mobile, inside MainNav) */}
            <div className="flex-1 flex items-center">
              <MainNav />
            </div>

            {/* Global search — renders desktop pill + mobile icon */}
            <GlobalSearch
              shooters={shootersList}
              competitions={competitionsList}
            />

            {/* Desktop right controls */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <RegionSelector />
              <ThemeToggle />
            </div>

          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link href="/" className="flex items-baseline gap-0 no-underline">
            <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm uppercase tracking-widest text-[var(--subtle)]">
              Shooter
            </span>
            <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-sm uppercase tracking-widest text-[var(--subtle)]">
              markt
            </span>
          </Link>
          <div className="flex items-center gap-5 flex-wrap">
            <Link href="/kontakt" className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              Kontakt
            </Link>
            <Link href="/privatnost" className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              Politika privatnosti
            </Link>
            <p className="text-xs text-[var(--subtle)]">
              © {new Date().getFullYear()} · Srpsko streljaštvo
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
