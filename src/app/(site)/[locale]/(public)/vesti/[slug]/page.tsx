import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedArticleBySlug } from "@/lib/cms/get-articles";
import { ArticleContent } from "@/components/cms-blocks/ArticleContent";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [t, locale, article] = await Promise.all([
    getTranslations("news"),
    getLocale(),
    getPublishedArticleBySlug(slug),
  ]);
  const alternates = buildAlternates(locale, `/vesti/${slug}`);
  if (!article) return { title: t("notFound"), alternates };
  return { title: article.title, alternates };
}

export default async function VestPage({ params }: Props) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
      <p className="text-sm text-[var(--muted)] mb-6">{article.excerpt}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ArticleContent content={article.content as any} />
    </div>
  );
}
