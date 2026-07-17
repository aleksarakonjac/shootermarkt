import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import {
  getPublishedArticleBySlug,
  getPublishedArticles,
  type ArticleSummary,
} from "@/lib/cms/get-articles";
import { ArticleContent } from "@/components/cms-blocks/ArticleContent";
import { ScopedLink } from "../../../components/ScopedLink";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import type { Scope } from "@/lib/scope";

export const revalidate = 300;

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ slug: string; scope: Scope }> };

type LexicalNode = { type: string; text?: string; children?: LexicalNode[] };
type LexicalContent = { root: { children: LexicalNode[] } };

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  vest:           "var(--brand-primary)",
  analiza:        "var(--brand-accent)",
  takmicenje:     "var(--success)",
  reprezentacija: "oklch(0.48 0.14 250)",
  oprema:         "var(--warning)",
  intervju:       "oklch(0.52 0.17 300)",
  rezultati:      "oklch(0.48 0.16 200)",
};

function getCategoryColor(cat: string | null): string {
  return cat ? (CATEGORY_COLOR[cat] ?? "var(--muted)") : "var(--muted)";
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function extractText(node: LexicalNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.children ?? []).map(extractText).join(" ");
}

function estimateReadingTime(content: LexicalContent): number {
  const text = content.root.children.map(extractText).join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, scope } = await params;
  const [t, locale, article] = await Promise.all([
    getTranslations("news"),
    getLocale(),
    getPublishedArticleBySlug(slug),
  ]);
  const alternates = buildAlternates(locale, scope, `/vesti/${slug}`);
  if (!article) return { title: t("notFound"), alternates };
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.coverImage?.url ? [article.coverImage.url] : [],
    },
    alternates,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VestPage({ params }: Props) {
  const { slug } = await params;

  const [article, locale, t] = await Promise.all([
    getPublishedArticleBySlug(slug),
    getLocale(),
    getTranslations("news"),
  ]);

  if (!article) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCategoryLabel = (cat: string | null) =>
    cat ? ((t as unknown as (k: string) => string)(`categories.${cat}`) ?? cat) : "";

  const readingMin = estimateReadingTime(article.content as LexicalContent);
  const accentColor = getCategoryColor(article.category);

  const relatedRaw = await getPublishedArticles({
    category: article.category ?? undefined,
    limit: 6,
  }).catch(() => [] as ArticleSummary[]);
  const related = relatedRaw.filter((a) => a.slug !== slug).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

      {/* Back nav */}
      <ScopedLink
        href="/vesti"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] mb-7 transition-colors group"
      >
        <svg
          width="14" height="14" viewBox="0 0 16 16" fill="none"
          aria-hidden="true"
          className="group-hover:-translate-x-0.5 transition-transform"
        >
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("backToNews")}
      </ScopedLink>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">

        {/* ── Left: article ── */}
        <article>

          {/* Category badge */}
          {article.category && (
            <span
              className="inline-block text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full text-white mb-4"
              style={{ background: accentColor }}
            >
              {getCategoryLabel(article.category)}
            </span>
          )}

          {/* Title */}
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] text-[var(--ink)] leading-tight mb-4"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            {article.title}
          </h1>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="text-lg text-[var(--muted)] leading-relaxed mb-5 max-w-2xl">
              {article.excerpt}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-sm text-[var(--subtle)] mb-6">
            {article.publishedAt && (
              <time
                dateTime={article.publishedAt}
                className="font-[family-name:var(--font-jetbrains-mono)] text-[13px] tabular-nums"
              >
                {formatDate(article.publishedAt, locale)}
              </time>
            )}
            <span aria-hidden="true" className="text-[var(--border-strong)]">·</span>
            <span className="text-[13px]">{t("readingTime", { min: readingMin })}</span>
            {article.tags.length > 0 && (
              <>
                <span aria-hidden="true" className="text-[var(--border-strong)]">·</span>
                <span className="text-[13px] text-[var(--subtle)] line-clamp-1">
                  {article.tags.slice(0, 3).map((tag) => tag.label).join(", ")}
                </span>
              </>
            )}
          </div>

          {/* Cover image */}
          {article.coverImage?.url && (
            <div className="relative w-full rounded-xl overflow-hidden mb-8 bg-[var(--surface-2)]" style={{ aspectRatio: "16/9" }}>
              <Image
                src={article.coverImage.url}
                alt={article.coverImage.alt ?? article.title}
                fill
                sizes="(min-width: 1280px) 800px, (min-width: 1024px) 60vw, 100vw"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Article body */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ArticleContent content={article.content as any} />

          {/* Tags footer */}
          {article.tags.length > 0 && (
            <div className="mt-10 pt-6 border-t border-[var(--border)]">
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={`${tag.type}:${tag.label}`}
                    className="px-3 py-1.5 rounded-full border border-[var(--border)] text-xs font-medium text-[var(--muted)]"
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* ── Right: sidebar ── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
          {related.length > 0 && (
            <RelatedWidget articles={related} title={t("relatedArticles")} locale={locale} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Related articles widget ───────────────────────────────────────────────────

const CATEGORY_COLOR_WIDGET: Record<string, string> = {
  vest:           "var(--brand-primary)",
  analiza:        "var(--brand-accent)",
  takmicenje:     "var(--success)",
  reprezentacija: "oklch(0.48 0.14 250)",
  oprema:         "var(--warning)",
  intervju:       "oklch(0.52 0.17 300)",
  rezultati:      "oklch(0.48 0.16 200)",
};

function formatDateShort(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RelatedWidget({
  articles,
  title,
  locale,
}: {
  articles: ArticleSummary[];
  title: string;
  locale: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div className="px-4 pt-4 pb-2.5 border-b border-[var(--border)]">
        <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-sm uppercase tracking-wide text-[var(--ink)]">
          {title}
        </span>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {articles.map((article) => {
          const imgUrl = article.coverImage?.url ?? null;
          const catColor = article.category
            ? (CATEGORY_COLOR_WIDGET[article.category] ?? "var(--muted)")
            : "var(--muted)";

          return (
            <ScopedLink
              key={article.id}
              href={`/vesti/${article.slug}`}
              className="flex gap-3 p-3 hover:bg-[var(--surface-2)] transition-colors group"
            >
              {/* Thumbnail */}
              <div
                className="relative shrink-0 w-[4.5rem] h-14 rounded-lg overflow-hidden bg-[var(--surface-2)]"
                style={!imgUrl ? { background: `${catColor}22` } : undefined}
              >
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={article.coverImage?.alt ?? article.title}
                    fill
                    sizes="72px"
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: catColor }}
                    />
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="flex flex-col justify-between min-w-0 flex-1 py-0.5">
                <h4 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[0.9rem] text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors leading-snug line-clamp-2">
                  {article.title}
                </h4>
                {article.publishedAt && (
                  <time
                    dateTime={article.publishedAt}
                    className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--subtle)] tabular-nums mt-1"
                  >
                    {formatDateShort(article.publishedAt, locale)}
                  </time>
                )}
              </div>
            </ScopedLink>
          );
        })}
      </div>
    </div>
  );
}
