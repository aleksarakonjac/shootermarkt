import { MainNav } from "./components/MainNav";
import { GlobalSearch } from "./GlobalSearch";
import HeaderHomeLink from "./components/HeaderHomeLink";
import ThemeToggle from "./components/ThemeToggle";
import { RegionSelector } from "./components/RegionSelector";
import { LocaleSwitcher } from "./components/LocaleSwitcher";
import { ScopedLink } from "./components/ScopedLink";
import Link from "next/link";
import { SiteHeader } from "./components/SiteHeader";
import { HeaderLiveTicker, TopOfPageTicker } from "./components/HeaderLiveTicker";
import { TickerDataProvider } from "./components/live-ticker-data";
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

  const [t, tCommon] = await Promise.all([getTranslations("footer"), getTranslations("common")]);

  return (
    <TickerDataProvider>
      <SiteHeader>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Na mobilnom se red sužava pri skrolovanju (SiteHeader postavlja data-compact). */}
          <div className="flex h-14 items-center gap-2 transition-[height] duration-200 group-data-[compact=true]:h-11 lg:gap-4 lg:group-data-[compact=true]:h-14 motion-reduce:transition-none">

            {/* Logo */}
            <ScopedLink href="/" className="flex items-baseline gap-0 shrink-0 no-underline">
              <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-[1.35rem] uppercase tracking-tight text-[var(--brand-primary)] leading-none">
                Shooter
              </span>
              <span className="font-[family-name:var(--font-barlow-condensed)] font-semibold text-[1.35rem] uppercase tracking-tight text-[var(--ink)] leading-none">
                markt
              </span>
            </ScopedLink>
            <div className="hidden lg:block lg:-mr-3.5"><HeaderHomeLink /></div>

            {/* Nav groups (desktop) + hamburger (mobile, inside MainNav) */}
            <div className="order-3 flex items-center lg:order-none lg:flex-1">
              <MainNav />
            </div>

            {/* Global search — renders desktop pill + mobile icon */}
            {/* Scope (mobile) — odmah vidljiv, ne samo u side meniju */}
            <div className="lg:hidden">
              <RegionSelector small />
            </div>

            <GlobalSearch />

            {/* Desktop right controls */}
            <div className="hidden lg:flex items-center gap-1 shrink-0">
              <RegionSelector />
              <LocaleSwitcher />
              <ThemeToggle />
            </div>

          </div>
        </div>
        <HeaderLiveTicker />
      </SiteHeader>

      <TopOfPageTicker />

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
              © {new Date().getFullYear()} <Link href="/admin" className="hover:text-[var(--ink)] transition-colors">Shootermarkt</Link>
            </p>
          </div>

        </div>
      </footer>
    </TickerDataProvider>
  );
}
