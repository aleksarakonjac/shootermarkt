import { describe, it, expect, vi } from "vitest";

const findMock = vi.fn();
const findByIDMock = vi.fn();

vi.mock("./get-payload-client", () => ({
  getPayloadClient: async () => ({
    find: findMock,
    findByID: findByIDMock,
  }),
}));

import { getPublishedArticles, getPublishedArticleBySlug } from "./get-articles";

describe("getPublishedArticles", () => {
  it("queries the articles collection filtered by status=published, sorted by -publishedAt", async () => {
    findMock.mockResolvedValueOnce({
      docs: [{ id: 1, title: "Naslov", slug: "naslov", excerpt: "...", publishedAt: "2026-07-01" }],
    });
    const articles = await getPublishedArticles();
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        where: { status: { equals: "published" } },
        sort: "-publishedAt",
      })
    );
    expect(articles).toHaveLength(1);
  });

  it("honors a caller's smaller homepage limit", async () => {
    findMock.mockResolvedValueOnce({ docs: [] });

    await getPublishedArticles({ limit: 4 });

    expect(findMock).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 4 }));
  });
});

describe("getPublishedArticleBySlug", () => {
  it("returns null when no published article matches the slug", async () => {
    findMock.mockResolvedValueOnce({ docs: [] });
    const article = await getPublishedArticleBySlug("nepostojeci");
    expect(article).toBeNull();
  });

  it("returns the article when found", async () => {
    findMock.mockResolvedValueOnce({
      docs: [{ id: 1, title: "Naslov", slug: "naslov", content: {}, excerpt: "..." }],
    });
    const article = await getPublishedArticleBySlug("naslov");
    expect(article?.slug).toBe("naslov");
  });
});
