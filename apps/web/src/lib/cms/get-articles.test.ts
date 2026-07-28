import { describe, it, expect, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => {
  vi.stubEnv("CMS_API_URL", "https://cms.test");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
});

import { getPublishedArticles, getPublishedArticleBySlug } from "./get-articles";

describe("getPublishedArticles", () => {
  it("fetches published articles sorted by publication date", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      docs: [{ id: 1, title: "Naslov", slug: "naslov", excerpt: "...", publishedAt: "2026-07-01" }],
    })));
    const articles = await getPublishedArticles();
    expect(fetchMock.mock.calls[0][0]).toContain("where%5Bstatus%5D%5Bequals%5D=published");
    expect(fetchMock.mock.calls[0][0]).toContain("sort=-publishedAt");
    expect(articles).toHaveLength(1);
  });

  it("honors a caller's smaller homepage limit", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] })));

    await getPublishedArticles({ limit: 4 });

    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("limit=4");
  });
});

describe("getPublishedArticleBySlug", () => {
  it("returns null when no published article matches the slug", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] })));
    const article = await getPublishedArticleBySlug("nepostojeci");
    expect(article).toBeNull();
  });

  it("returns the article when found", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      docs: [{ id: 1, title: "Naslov", slug: "naslov", content: {}, excerpt: "..." }],
    })));
    const article = await getPublishedArticleBySlug("naslov");
    expect(article?.slug).toBe("naslov");
  });
});
