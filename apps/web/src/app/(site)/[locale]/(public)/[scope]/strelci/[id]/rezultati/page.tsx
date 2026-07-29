import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { buildAlternates } from "@/i18n/alternates";
import type { Scope } from "@/lib/scope";
import { getShooterResultsPage } from "@/lib/shooter-results";
import { ShooterResultsArchive } from "@/components/result-display/ShooterResultsArchive";
import { ScopedLink } from "../../../../components/ScopedLink";

type Props = { params: Promise<{ id: string; scope: Scope }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, scope } = await params;
  const [shooter, locale] = await Promise.all([
    db.query.shooters.findFirst({ where: eq(shooters.id, Number(id)) }),
    getLocale(),
  ]);
  const alternates = buildAlternates(locale, scope, `/strelci/${id}/rezultati`);
  if (!shooter) return { title: "Rezultati", alternates };
  return { title: `${shooter.lastName} ${shooter.firstName} — Rezultati | Shootermarkt`, alternates };
}

export default async function ShooterResultsPage({ params }: Props) {
  const { id } = await params;
  const shooterId = Number(id);
  if (!Number.isInteger(shooterId) || shooterId < 1) notFound();

  const [shooter, initialPage, locale, t, tProfile] = await Promise.all([
    db.query.shooters.findFirst({ where: eq(shooters.id, shooterId), with: { club: true } }),
    getShooterResultsPage(shooterId),
    getLocale(),
    getTranslations("shooters"),
    getTranslations("shooters.profile"),
  ]);
  if (!shooter) notFound();

  const shooterName = `${shooter.lastName} ${shooter.firstName}`;

  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <nav className="mb-8 flex items-center gap-2 text-xs text-[var(--muted)]" aria-label="Breadcrumb">
      <ScopedLink href="/strelci" className="transition-colors hover:text-[var(--ink)]">{t("title")}</ScopedLink>
      <span className="text-[var(--subtle)]">/</span>
      <ScopedLink href={`/strelci/${shooterId}`} className="transition-colors hover:text-[var(--ink)]">{shooterName}</ScopedLink>
      <span className="text-[var(--subtle)]">/</span>
      <span className="font-medium text-[var(--ink)]">{tProfile("resultsHistory")}</span>
    </nav>

    <div className="mb-8 flex items-center gap-3 border-b border-[var(--border)] pb-5 sm:gap-4">
      {shooter.avatarUrl ? <Image src={shooter.avatarUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-xl object-cover ring-1 ring-[var(--border)]" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[var(--muted)]">{shooter.firstName[0]}{shooter.lastName[0]}</div>}
      <div className="min-w-0">
        <h1 className="truncate font-[family-name:var(--font-barlow-condensed)] text-2xl font-extrabold uppercase leading-none tracking-tight text-[var(--ink)] sm:text-3xl">{shooterName}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{tProfile("resultsHistory")}{shooter.club?.name ? ` · ${shooter.club.name}` : ""}</p>
      </div>
    </div>

    <ShooterResultsArchive shooterId={shooterId} initialResults={initialPage.results} initialCursor={initialPage.nextCursor} allLabel={tProfile("allDisciplines")} loadMoreLabel={tProfile("loadMoreResults")} loadingLabel={tProfile("loadingResults")} searchPlaceholder={tProfile("searchResults")} dateLabel={tProfile("dateFilter")} fromLabel={tProfile("dateFrom")} toLabel={tProfile("dateTo")} applyDateLabel={tProfile("applyDateFilter")} dateDaysLabel={tProfile("dateDays")} dateMonthsLabel={tProfile("dateMonths")} dateYearsLabel={tProfile("dateYears")} clearDateLabel={tProfile("clearDateFilter")} emptyLabel={tProfile("noResults")} locale={locale} />
  </div>;
}
