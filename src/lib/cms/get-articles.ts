import type { Where } from "payload";
import { getPayloadClient } from "./get-payload-client";

export interface ArticleTag {
  type: "topic" | "competition" | "shooter";
  label: string;
  refId?: number;
}

export interface CoverImageData {
  url: string;
  filename?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface ArticleSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: CoverImageData | null;
  category: string | null;
  tags: ArticleTag[];
  publishedAt: string | null;
}

export interface ArticleDetail extends ArticleSummary {
  content: unknown;
}

export async function getPublishedArticles(opts?: {
  category?: string;
  limit?: number;
}): Promise<ArticleSummary[]> {
  const payload = await getPayloadClient();
  const where: Where = { status: { equals: "published" } };
  if (opts?.category) where.category = { equals: opts.category };
  const result = await payload.find({
    collection: "articles",
    where,
    sort: "-publishedAt",
    depth: 2,
    limit: opts?.limit ?? 50,
  });
  return result.docs.map((doc) => ({
    id: doc.id as number,
    title: doc.title as string,
    slug: doc.slug as string,
    excerpt: doc.excerpt as string,
    coverImage: (doc.coverImage && typeof doc.coverImage === "object" && "url" in doc.coverImage)
      ? (doc.coverImage as CoverImageData)
      : null,
    category: (doc.category as string | null | undefined) ?? null,
    tags: ((doc.tags as ArticleTag[] | null | undefined) ?? []),
    publishedAt: (doc.publishedAt as string | null | undefined) ?? null,
  }));
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" }, slug: { equals: slug } },
    depth: 2,
    limit: 1,
  });
  const doc = result.docs[0];
  if (!doc) return null;
  return {
    id: doc.id as number,
    title: doc.title as string,
    slug: doc.slug as string,
    excerpt: doc.excerpt as string,
    coverImage: (doc.coverImage && typeof doc.coverImage === "object" && "url" in doc.coverImage)
      ? (doc.coverImage as CoverImageData)
      : null,
    category: (doc.category as string | null | undefined) ?? null,
    tags: ((doc.tags as ArticleTag[] | null | undefined) ?? []),
    publishedAt: (doc.publishedAt as string | null | undefined) ?? null,
    content: doc.content,
  };
}

export async function getAllPublishedTags(): Promise<ArticleTag[]> {
  const articles = await getPublishedArticles({ limit: 200 });
  const seen = new Set<string>();
  const tags: ArticleTag[] = [];
  for (const article of articles) {
    for (const tag of article.tags) {
      const key = `${tag.type}:${tag.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        tags.push(tag);
      }
    }
  }
  return tags;
}
