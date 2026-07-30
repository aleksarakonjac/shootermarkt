import Image from "next/image";
import { ScopedLink } from "./ScopedLink";
import { getRelatedCompetitionArticles, type ArticleSummary } from "@/lib/cms/get-articles";

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "sr-RS", {
    day: "numeric",
    month: "short",
  });
}

export async function SidebarCompetitionNews({ competitionIds, locale }: { competitionIds: number[]; locale: string }) {
  let articles: ArticleSummary[];
  try {
    articles = await getRelatedCompetitionArticles(competitionIds);
  } catch {
    return null;
  }
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="sidebar-competition-news" className="hidden lg:block">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="sidebar-competition-news" className="font-[family-name:var(--font-barlow-condensed)] text-xl font-bold uppercase tracking-wider text-[var(--ink)]">
          {locale === "en" ? "News from the range" : "Vesti sa strelišta"}
        </h2>
        <ScopedLink href="/vesti" className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">
          {locale === "en" ? "All news →" : "Sve vesti →"}
        </ScopedLink>
      </div>
      <div className="flex flex-col gap-3">
        {articles.map((article, index) => index === 0 ? (
          <ScopedLink key={article.id} href={`/vesti/${article.slug}`} className="group block">
            <article className="relative aspect-[16/10] overflow-hidden rounded-md bg-[var(--surface-2)]">
              {article.coverImage?.url ? (
                <Image src={article.coverImage.url} alt={article.coverImage.alt ?? article.title} fill sizes="(min-width: 1024px) 320px, 100vw" className="object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
              ) : (
                <span className="flex h-full items-center justify-center px-1 text-center font-[family-name:var(--font-barlow-condensed)] text-xs font-bold uppercase text-[var(--muted)]">
                  {article.category ?? (locale === "en" ? "News" : "Vest")}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-3 pt-20 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                  {article.category ?? (locale === "en" ? "News" : "Vest")}{article.publishedAt ? ` · ${formatDate(article.publishedAt, locale)}` : ""}
                </p>
                <h3 className="mt-1 line-clamp-2 font-[family-name:var(--font-barlow-condensed)] text-lg font-bold leading-tight">
                  {article.title}
                </h3>
              </div>
            </article>
          </ScopedLink>
        ) : (
          <ScopedLink key={article.id} href={`/vesti/${article.slug}`} className="group flex gap-3 border-t border-[var(--border)] pt-3">
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-[var(--surface-2)]">
              {article.coverImage?.url ? (
                <Image src={article.coverImage.url} alt={article.coverImage.alt ?? article.title} fill sizes="96px" className="object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 py-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">
                {article.category ?? (locale === "en" ? "News" : "Vest")}{article.publishedAt ? ` · ${formatDate(article.publishedAt, locale)}` : ""}
              </p>
              <h3 className="mt-1 line-clamp-2 font-[family-name:var(--font-barlow-condensed)] text-[0.95rem] font-bold leading-snug text-[var(--ink)] transition-colors group-hover:text-[var(--brand-primary)]">
                {article.title}
              </h3>
            </div>
          </ScopedLink>
        ))}
      </div>
    </section>
  );
}
