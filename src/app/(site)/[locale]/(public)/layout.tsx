import { db } from "@/lib/db";
import { shooters, clubs, competitions } from "@/lib/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { MainNav } from "./components/MainNav";
import { GlobalSearch } from "./GlobalSearch";
import HeaderHomeLink from "./components/HeaderHomeLink";
import ThemeToggle from "./components/ThemeToggle";
import { RegionSelector } from "./components/RegionSelector";
import { LocaleSwitcher } from "./components/LocaleSwitcher";
import { ScopedLink } from "./components/ScopedLink";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 300;

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PublicLayout({ children, params }: Props) {
  const { locale } = await params;
  // Must call before any next-intl server API — each layout runs in its own
  // async context so the setRequestLocale from [locale]/layout.tsx doesn't carry over.
  setRequestLocale(locale);

  const [shootersList, competitionsList, t, tCommon] = await Promise.all([
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
      .where(and(eq(shooters.verified, true), inArray(shooters.apparatus, [...MVP_APPARATUS])))
      .orderBy(shooters.lastName, shooters.firstName),

    db
      .select({
        id: competitions.id,
        name: competitions.name,
        nameSr: competitions.nameSr,
        nameEn: competitions.nameEn,
        date: competitions.date,
        level: competitions.level,
      })
      .from(competitions)
      .orderBy(desc(competitions.date))
      .limit(500),

    getTranslations("footer"),
    getTranslations("common"),
  ]);

  const translatedCompetitions = competitionsList.map((comp) => ({
    ...comp,
    name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name),
  }));

  return (
    <>
      <header className="sticky top-0 z-[200] bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-4">

            {/* Logo */}
            <ScopedLink href="/" className="flex items-baseline gap-0 shrink-0 no-underline">
              <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.35rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">
                Shooter
              </span>
              <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.35rem] uppercase tracking-tight text-[var(--ink)] leading-none">
                markt
              </span>
            </ScopedLink>
            <div className="hidden md:block"><HeaderHomeLink /></div>

            {/* Nav groups (desktop) + hamburger (mobile, inside MainNav) */}
            <div className="flex-1 flex items-center">
              <MainNav />
            </div>

            {/* Global search — renders desktop pill + mobile icon */}
            <GlobalSearch
              shooters={shootersList}
              competitions={translatedCompetitions}
            />

            {/* Desktop right controls */}
            <div className="hidden md:flex items-center gap-1 shrink-0">
              <RegionSelector />
              <LocaleSwitcher />
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
              <ScopedLink href="/" className="inline-flex items-baseline gap-0 no-underline mb-3 group">
                <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.6rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none transition-opacity group-hover:opacity-80">
                  Shooter
                </span>
                <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.6rem] uppercase tracking-tight text-[var(--ink)] leading-none transition-opacity group-hover:opacity-80">
                  markt
                </span>
              </ScopedLink>
              <p className="text-[0.8125rem] text-[var(--muted)] leading-snug" style={{ textWrap: "pretty" } as React.CSSProperties}>
                {t("tagline")}
              </p>
            </div>

            {/* Nav columns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1">

              {/* Strelci */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  {t("shootersSection")}
                </p>
                <ul className="space-y-2">
                  <li>
                    <ScopedLink href="/strelci" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      {t("profiles")}
                    </ScopedLink>
                  </li>
                </ul>
              </div>

              {/* Takmičenja */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  {t("competitionsSection")}
                </p>
                <ul className="space-y-2">
                  <li>
                    <ScopedLink href="/takmicenja" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      {t("competitionList")}
                    </ScopedLink>
                  </li>
                  <li>
                    <ScopedLink href="/takmicenja?view=cal" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      {t("calendar")}
                    </ScopedLink>
                  </li>
                </ul>
              </div>

              {/* Statistike */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  {t("statisticsSection")}
                </p>
                <ul className="space-y-2">
                  <li>
                    <ScopedLink href="/rangiranje" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      {t("ranking")}
                    </ScopedLink>
                  </li>
                  <li>
                    <ScopedLink href="/rangiranje?view=h2h" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      {t("h2h")}
                    </ScopedLink>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-sm text-[var(--subtle)]">{t("clubLeaderboard")}</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.55rem] text-[var(--subtle)]">{tCommon("soon")}</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-sm text-[var(--subtle)]">{t("trendAnalysis")}</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.55rem] text-[var(--subtle)]">{tCommon("soon")}</span>
                  </li>
                </ul>
              </div>

              {/* Platforma */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-sm tracking-tight text-[var(--ink)] mb-3">
                  {t("platformSection")}
                </p>
                <ul className="space-y-2">
                  <li>
                    <ScopedLink href="/kontakt" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      {t("contact")}
                    </ScopedLink>
                  </li>
                  <li>
                    <ScopedLink href="/privatnost" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                      {t("privacy")}
                    </ScopedLink>
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
          </div>

        </div>
      </footer>
    </>
  );
}
