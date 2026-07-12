import Image from "next/image";
import { ScopedLink } from "@/app/(site)/[locale]/(public)/components/ScopedLink";
import { getRelatedArticles } from "@/lib/cms/get-articles";
import type { ArticleSummary } from "@/lib/cms/get-articles";

const CATEGORY_COLOR: Record<string, string> = {
  vest:       "var(--brand-primary)",
  analiza:    "var(--brand-accent)",
  takmicenje: "var(--success)",
  oprema:     "var(--warning)",
  intervju:   "oklch(0.52 0.17 300)",
  rezultati:  "oklch(0.48 0.16 200)",
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RelatedArticleCard({
  article,
  locale,
}: {
  article: ArticleSummary;
  locale: string;
}) {
  const imgUrl = article.coverImage?.url ?? null;
  const accentColor = article.category
    ? (CATEGORY_COLOR[article.category] ?? "var(--muted)")
    : "var(--muted)";

  return (
    <ScopedLink href={`/vesti/${article.slug}`} className="group block">
      <article className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 hover:border-[var(--brand-primary)] transition-colors duration-150 overflow-hidden h-full">
        <div
          className="relative shrink-0 w-24 h-20 rounded-lg overflow-hidden"
          style={{
            background: imgUrl
              ? undefined
              : `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}10 100%)`,
          }}
        >
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={article.coverImage?.alt ?? article.title}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded text-white font-[family-name:var(--font-barlow-condensed)]"
                style={{ background: accentColor }}
              >
                {article.category ?? "vest"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 min-w-0 py-0.5">
          <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[0.95rem] text-[var(--ink)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors duration-150 line-clamp-2">
            {article.title}
          </h3>
          <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">
            {article.excerpt}
          </p>
          {article.publishedAt && (
            <time
              className="text-[10px] text-[var(--subtle)] mt-auto font-[family-name:var(--font-jetbrains-mono)] tabular-nums"
              dateTime={article.publishedAt}
            >
              {formatDate(article.publishedAt, locale)}
            </time>
          )}
        </div>
      </article>
    </ScopedLink>
  );
}

interface Props {
  type: "shooter" | "competition";
  refId: number;
  locale: string;
}

export async function RelatedNewsSection({ type, refId, locale }: Props) {
  let articles: ArticleSummary[] = [];
  try {
    articles = await getRelatedArticles(type, refId);
  } catch {
    return null;
  }

  return (
    <div className="mt-10 pt-10 border-t border-[var(--border)]">
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-tight text-[var(--ink)]"
          style={{ letterSpacing: "-0.02em" }}
        >
          Povezane vesti
        </h2>
        <ScopedLink
          href="/vesti"
          className="text-xs font-semibold text-[var(--brand-primary)] hover:underline shrink-0"
        >
          Sve vesti →
        </ScopedLink>
      </div>

      {articles.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Još nema vesti vezanih za ovu stavku.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {articles.map((article) => (
            <RelatedArticleCard key={article.id} article={article} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
