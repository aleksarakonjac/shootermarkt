export interface ArticleTag {
  type: "topic" | "competition" | "shooter" | "club" | "discipline";
  label: string;
  refId?: number;
  disciplineCode?: string;
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

type CmsArticle = Record<string, unknown>;

const cmsApiUrl = process.env.CMS_API_URL?.replace(/\/$/, "");

function toCoverImage(value: unknown): CoverImageData | null {
  if (!value || typeof value !== "object") return null;
  const image = value as Record<string, unknown>;
  if (typeof image.url !== "string") return null;
  return {
    url: image.url,
    filename: typeof image.filename === "string" ? image.filename : undefined,
    alt: typeof image.alt === "string" ? image.alt : undefined,
    width: typeof image.width === "number" ? image.width : undefined,
    height: typeof image.height === "number" ? image.height : undefined,
  };
}

function toTags(value: unknown): ArticleTag[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tag) => {
    if (!tag || typeof tag !== "object") return [];
    const item = tag as Record<string, unknown>;
    if (
      !["topic", "competition", "shooter", "club", "discipline"].includes(String(item.type)) ||
      typeof item.label !== "string"
    ) return [];
    return [{
      type: item.type as ArticleTag["type"],
      label: item.label,
      refId: typeof item.refId === "number" ? item.refId : undefined,
      disciplineCode: typeof item.disciplineCode === "string" ? item.disciplineCode : undefined,
    }];
  });
}

function toSummary(doc: CmsArticle): ArticleSummary {
  return {
    id: Number(doc.id),
    title: String(doc.title ?? ""),
    slug: String(doc.slug ?? ""),
    excerpt: String(doc.excerpt ?? ""),
    coverImage: toCoverImage(doc.coverImage),
    category: typeof doc.category === "string" ? doc.category : null,
    tags: toTags(doc.tags),
    publishedAt: typeof doc.publishedAt === "string" ? doc.publishedAt : null,
  };
}

async function fetchArticles(params: URLSearchParams): Promise<CmsArticle[]> {
  if (!cmsApiUrl) return [];
  const response = await fetch(`${cmsApiUrl}/cms/api/articles?${params}`, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`CMS request failed: ${response.status}`);
  const body = await response.json() as { docs?: unknown };
  return Array.isArray(body.docs) ? body.docs as CmsArticle[] : [];
}

export async function getPublishedArticles(opts?: {
  category?: string;
  limit?: number;
}): Promise<ArticleSummary[]> {
  const params = new URLSearchParams({
    "where[status][equals]": "published",
    sort: "-publishedAt",
    depth: "2",
    limit: String(opts?.limit ?? 50),
  });
  if (opts?.category) params.set("where[category][equals]", opts.category);
  return (await fetchArticles(params)).map(toSummary);
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  const params = new URLSearchParams({
    "where[status][equals]": "published",
    "where[slug][equals]": slug,
    depth: "2",
    limit: "1",
  });
  const doc = (await fetchArticles(params))[0];
  if (!doc) return null;
  return { ...toSummary(doc), content: doc.content };
}

export async function getRelatedArticles(
  type: ArticleTag["type"],
  refId: number,
  limit = 3
): Promise<ArticleSummary[]> {
  const articles = await getPublishedArticles({ limit: 200 });
  return articles
    .filter((a) => a.tags.some((t) => t.type === type && t.refId === refId))
    .slice(0, limit);
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
