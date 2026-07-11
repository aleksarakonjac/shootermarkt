import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedArticles, getAllPublishedTags } from "@/lib/cms/get-articles";
import {
  getUpcomingCompetitions,
  getTopShootersByDiscipline,
} from "@/lib/cms/get-vesti-sidebar";
import { getLocale, getTranslations } from "next-intl/server";
import { getLevelLabel } from "@/lib/competition-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("news");
  return { title: t("title") };
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_KEYS = ["vest", "analiza", "takmicenje", "oprema", "intervju", "rezultati"] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

const CATEGORY_COLOR: Record<string, string> = {
  vest:       "var(--brand-primary)",
  analiza:    "var(--brand-accent)",
  takmicenje: "var(--success)",
  oprema:     "var(--warning)",
  intervju:   "oklch(0.52 0.17 300)",
  rezultati:  "oklch(0.48 0.16 200)",
};

const DISC_ORDER = ["ARM", "ARW", "APM", "APW"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(iso: string, locale: string) {
  const d = new Date(iso);
  const monthLocale = locale === "en" ? "en-GB" : "sr-Latn-RS";
  return {
    day: d.getDate(),
    month: d.toLocaleString(monthLocale, { month: "short" }).replace(".", "").toUpperCase(),
  };
}

function getCategoryColor(cat: string | null) {
  return cat ? (CATEGORY_COLOR[cat] ?? "var(--muted)") : "var(--muted)";
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: Promise<{ kategorija?: string }>;
};

export default async function VestiPage({ searchParams }: Props) {
  const sp = await searchParams;
  const activeCategory = sp.kategorija ?? "";
  const locale = await getLocale();
  const t = await getTranslations("news");

  function getCategoryLabel(cat: string | null): string {
    if (!cat) return t("categories.vest");
    return t(`categories.${cat}` as any) ?? cat;
  }

  const CATEGORIES = CATEGORY_KEYS.map((key) => ({
    value: key,
    label: getCategoryLabel(key),
  }));

  const [articles, tags, upcoming, topShooters] = await Promise.all([
    getPublishedArticles(activeCategory ? { category: activeCategory } : undefined).catch(() => []),
    getAllPublishedTags().catch(() => []),
    getUpcomingCompetitions(6).catch(() => []),
    getTopShootersByDiscipline().catch(() => ({})),
  ]);

  const [featured, ...rest] = articles;
  const featuredColor = getCategoryColor(featured?.category ?? null);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Page header ── */}
      <div className="flex items-baseline justify-between mb-5">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-2xl uppercase tracking-wider text-[var(--ink)]"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          {t("title")}
        </h1>
        {articles.length > 0 && (
          <span className="text-xs text-[var(--muted)] tabular-nums">
            {t("postCount", { count: articles.length })}
          </span>
        )}
      </div>

      {/* ── Category filter chips ── */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <Link
          href="/vesti"
          className={`shrink-0 px-2.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
            !activeCategory
              ? "bg-[var(--ink)] text-[var(--bg)]"
              : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
          }`}
        >
          {t("allCategories")}
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={`/vesti?kategorija=${cat.value}`}
            className={`shrink-0 px-2.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              activeCategory === cat.value
                ? "text-white"
                : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
            }`}
            style={activeCategory === cat.value
              ? { background: CATEGORY_COLOR[cat.value] }
              : undefined
            }
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* ── Main layout: articles + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* Left: articles */}
        <div className="min-w-0">

          {articles.length === 0 ? (
            <EmptyState
              activeCategory={activeCategory}
              label={activeCategory ? getCategoryLabel(activeCategory) : ""}
              t={t}
            />
          ) : (
            <>
              {/* Hero */}
              {featured && (
                <HeroCard
                  article={featured}
                  accentColor={featuredColor}
                  categoryLabel={getCategoryLabel(featured.category)}
                  locale={locale}
                />
              )}

              {/* Grid */}
              {rest.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rest.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      accentColor={getCategoryColor(article.category)}
                      categoryLabel={getCategoryLabel(article.category)}
                      locale={locale}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
          <UpcomingWidget
            competitions={upcoming}
            title={t("upcomingWidget")}
            emptyLabel={t("upcomingEmpty")}
            seeAllLabel={t("allCategories")}
            locale={locale}
            getLevelLabel={(level) => getLevelLabel(level, locale)}
          />
          <TopShootersWidget
            topShooters={topShooters}
            title={t("topFormWidget")}
            rankingLabel={locale === "en" ? "Ranking" : "Rangiranje"}
          />
          {tags.length > 0 && <TagsWidget tags={tags} title={t("popularTags")} />}
        </aside>
      </div>
    </div>
  );
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function HeroCard({
  article,
  accentColor,
  categoryLabel,
  locale,
}: {
  article: Awaited<ReturnType<typeof getPublishedArticles>>[0];
  accentColor: string;
  categoryLabel: string;
  locale: string;
}) {
  const imgUrl = article.coverImage?.url ?? null;
  return (
    <Link href={`/vesti/${article.slug}`} className="group block">
      <article
        className="relative overflow-hidden rounded-xl min-h-[360px] flex flex-col justify-end"
        style={{
          background: imgUrl
            ? undefined
            : `linear-gradient(135deg, ${accentColor}22 0%, var(--surface-2) 100%)`,
        }}
      >
        {imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgUrl}
            alt={article.coverImage?.alt ?? article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        <div
          className="absolute inset-0"
          style={{
            background: imgUrl
              ? "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.32) 55%, transparent 100%)"
              : "none",
          }}
        />

        {!imgUrl && (
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accentColor }} />
        )}

        <div className="relative z-10 p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full text-white"
              style={{ background: accentColor }}
            >
              {categoryLabel}
            </span>
          </div>

          <h2
            className={`font-[family-name:var(--font-barlow-condensed)] font-bold text-2xl md:text-3xl leading-tight group-hover:opacity-90 transition-opacity ${imgUrl ? "text-white" : "text-[var(--ink)]"}`}
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            {article.title}
          </h2>
          <p className={`text-sm line-clamp-2 max-w-prose ${imgUrl ? "text-white/80" : "text-[var(--muted)]"}`}>
            {article.excerpt}
          </p>

          <div className={`flex items-center gap-2 mt-2 text-[11px] ${imgUrl ? "text-white/60" : "text-[var(--subtle)]"}`}>
            {article.publishedAt && <span>{formatDate(article.publishedAt, locale)}</span>}
            {article.tags.length > 0 && (
              <>
                <span>·</span>
                <span className="line-clamp-1">
                  {article.tags.slice(0, 3).map((t) => t.label).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

// ── Article card (grid) ───────────────────────────────────────────────────────

function ArticleCard({
  article,
  accentColor,
  categoryLabel,
  locale,
}: {
  article: Awaited<ReturnType<typeof getPublishedArticles>>[0];
  accentColor: string;
  categoryLabel: string;
  locale: string;
}) {
  const imgUrl = article.coverImage?.url ?? null;
  return (
    <Link href={`/vesti/${article.slug}`} className="group block">
      <article className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 hover:border-[var(--brand-primary)] transition-colors overflow-hidden">
        <div
          className="shrink-0 w-24 h-20 rounded-lg overflow-hidden"
          style={{
            background: imgUrl
              ? undefined
              : `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}10 100%)`,
          }}
        >
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt={article.coverImage?.alt ?? article.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded text-white"
                style={{ background: accentColor }}
              >
                {categoryLabel}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 min-w-0 py-0.5">
          <h3
            className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[0.95rem] text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors line-clamp-2"
          >
            {article.title}
          </h3>
          <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">
            {article.excerpt}
          </p>
          {article.publishedAt && (
            <time
              className="text-[10px] text-[var(--subtle)] mt-auto font-[family-name:var(--font-jetbrains-mono)]"
              dateTime={article.publishedAt}
            >
              {formatDate(article.publishedAt, locale)}
            </time>
          )}
        </div>
      </article>
    </Link>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  activeCategory,
  label,
  t,
}: {
  activeCategory: string;
  label: string;
  t: any;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center gap-3 text-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
        style={{ background: "var(--surface-2)" }}
      >
        📰
      </div>
      <p className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg uppercase tracking-wide text-[var(--ink)]">
        {activeCategory ? t("emptyInCategory", { label }) : t("emptyTitle")}
      </p>
      <p className="text-sm text-[var(--muted)] max-w-xs">
        {t("emptySubtitle")}
      </p>
      {activeCategory && (
        <Link
          href="/vesti"
          className="mt-2 text-xs font-semibold text-[var(--brand-primary)] hover:underline"
        >
          {t("allCategoriesLink")}
        </Link>
      )}
    </div>
  );
}

// ── Sidebar shared ────────────────────────────────────────────────────────────

function WidgetHeader({ title, linkHref, linkLabel }: { title: string; linkHref: string; linkLabel: string }) {
  return (
    <div className="px-4 pt-4 pb-2.5 flex items-center justify-between border-b border-[var(--border)]">
      <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm uppercase tracking-wide text-[var(--ink)]">
        {title}
      </span>
      <Link
        href={linkHref}
        className="text-xs font-semibold text-[var(--brand-primary)] hover:underline shrink-0"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}

// ── Sidebar: upcoming competitions ───────────────────────────────────────────

function UpcomingWidget({
  competitions,
  title,
  emptyLabel,
  seeAllLabel,
  locale,
  getLevelLabel,
}: {
  competitions: Awaited<ReturnType<typeof getUpcomingCompetitions>>;
  title: string;
  emptyLabel: string;
  seeAllLabel: string;
  locale: string;
  getLevelLabel: (level: string) => string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <WidgetHeader title={title} linkHref="/takmicenja" linkLabel={seeAllLabel} />

      {competitions.length === 0 ? (
        <p className="px-4 py-3 text-sm text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {competitions.map((comp) => {
            const { day, month } = formatDateShort(comp.date, locale);
            const displayName = locale === "en" ? (comp.nameEn ?? comp.nameSr ?? comp.name) : (comp.nameSr ?? comp.name);
            return (
              <li key={comp.id}>
                <Link
                  href={`/takmicenja/${comp.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors group"
                >
                  <div className="shrink-0 w-9 text-center">
                    <div className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-lg leading-none text-[var(--ink)]">
                      {day}
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mt-0.5">
                      {month}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors line-clamp-1 leading-snug">
                      {displayName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-[var(--muted)]">
                        {getLevelLabel(comp.level)}
                      </span>
                      {comp.location && (
                        <>
                          <span className="text-[var(--border-strong)]">·</span>
                          <span className="text-[11px] text-[var(--muted)] truncate">{comp.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Sidebar: top shooters ─────────────────────────────────────────────────────

const DISC_LABEL_SR: Record<string, string> = {
  ARM: "10m AR Muški",
  ARW: "10m AR Žene",
  APM: "10m AP Muški",
  APW: "10m AP Žene",
};

const DISC_LABEL_EN: Record<string, string> = {
  ARM: "10m AR Men",
  ARW: "10m AR Women",
  APM: "10m AP Men",
  APW: "10m AP Women",
};

function TopShootersWidget({
  topShooters,
  title,
  rankingLabel,
}: {
  topShooters: Awaited<ReturnType<typeof getTopShootersByDiscipline>>;
  title: string;
  rankingLabel: string;
}) {
  const hasAny = DISC_ORDER.some((code) => (topShooters[code]?.length ?? 0) > 0);
  if (!hasAny) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <WidgetHeader title={title} linkHref="/rangiranje" linkLabel={rankingLabel} />

      <div className="divide-y divide-[var(--border)]">
        {DISC_ORDER.map((code) => {
          const rows = topShooters[code];
          if (!rows?.length) return null;
          return (
            <div key={code} className="px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)] mb-2">
                {DISC_LABEL_SR[code] ?? code}
              </div>
              <ol className="flex flex-col gap-1.5">
                {rows.map((row, i) => (
                  <li key={row.shooterId} className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-bold text-[var(--subtle)] w-4 shrink-0">
                      {i + 1}
                    </span>
                    <Link
                      href={`/strelci/${row.shooterId}`}
                      className="text-[13px] text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors truncate flex-1"
                    >
                      {row.firstName} {row.lastName}
                    </Link>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] tabular-nums shrink-0">
                      {Number(row.bestScore).toFixed(1)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar: tags ─────────────────────────────────────────────────────────────

function TagsWidget({
  tags,
  title,
}: {
  tags: Awaited<ReturnType<typeof getAllPublishedTags>>;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <span className="block font-[family-name:var(--font-barlow-condensed)] font-bold text-sm uppercase tracking-wide text-[var(--ink)] mb-3">
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {tags.slice(0, 20).map((tag, i) => (
          <span
            key={i}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors cursor-default"
          >
            {tag.label}
          </span>
        ))}
      </div>
    </div>
  );
}
