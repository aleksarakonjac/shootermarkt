import { getPayloadClient } from "./get-payload-client";

export interface ArticleSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: unknown;
  author: unknown;
  publishedAt: string;
}

export interface ArticleDetail extends ArticleSummary {
  content: unknown;
}

export async function getPublishedArticles(): Promise<ArticleSummary[]> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    sort: "-publishedAt",
    depth: 2,
  });
  return result.docs as unknown as ArticleSummary[];
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" }, slug: { equals: slug } },
    depth: 2,
    limit: 1,
  });
  return (result.docs[0] as unknown as ArticleDetail) ?? null;
}
