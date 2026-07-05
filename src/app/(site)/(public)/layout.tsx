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

      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Main grid */}
          <div className="py-12 flex flex-col lg:flex-row gap-10 lg:gap-16">

            {/* Brand */}
            <div className="lg:w-[200px] shrink-0">
              <Link href="/" className="inline-flex items-baseline gap-0 no-underline mb-3 group">
                <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.1rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none transition-opacity group-hover:opacity-80">
                  Shooter
                </span>
                <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.1rem] uppercase tracking-tight text-[var(--ink)] leading-none transition-opacity group-hover:opacity-80">
                  markt
                </span>
              </Link>
              <p className="text-[0.8125rem] text-[var(--muted)] leading-snug" style={{ textWrap: "pretty" } as React.CSSProperties}>
                Centralna platforma za praćenje srpskog streljačkog sporta.
              </p>
            </div>

            {/* Nav columns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1">

              {/* Strelci */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  Strelci
                </p>
                <ul className="space-y-2">
                  <li>
                    <Link href="/strelci" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      Profili
                    </Link>
                  </li>
                  <li>
                    <Link href="/rangiranje" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      Rangiranje
                    </Link>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-sm text-[var(--subtle)]">Head-to-head</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.55rem] text-[var(--subtle)]">soon</span>
                  </li>
                </ul>
              </div>

              {/* Takmičenja */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  Takmičenja
                </p>
                <ul className="space-y-2">
                  <li>
                    <Link href="/takmicenja" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      Lista i arhiva
                    </Link>
                  </li>
                  <li>
                    <Link href="/kalendar" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      Kalendar
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Statistike */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  Statistike
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-1.5">
                    <span className="text-sm text-[var(--subtle)]">Klub leaderboard</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.55rem] text-[var(--subtle)]">soon</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-sm text-[var(--subtle)]">Trend analiza</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.55rem] text-[var(--subtle)]">soon</span>
                  </li>
                </ul>
              </div>

              {/* Platforma */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  Platforma
                </p>
                <ul className="space-y-2">
                  <li>
                    <Link href="/kontakt" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      Kontakt
                    </Link>
                  </li>
                  <li>
                    <Link href="/privatnost" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      Politika privatnosti
                    </Link>
                  </li>
                </ul>
              </div>

            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-[var(--border)] py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <p className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">
              © {new Date().getFullYear()} Shootermarkt
            </p>
            <p className="text-xs text-[var(--subtle)]">
              Srpski streljački savez · Pančevo, Srbija
            </p>
          </div>

        </div>
      </footer>
    </>
  );
}
