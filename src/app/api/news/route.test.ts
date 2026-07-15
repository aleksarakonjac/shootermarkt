import { describe, expect, it, vi } from "vitest";

const { getPublishedArticles } = vi.hoisted(() => ({ getPublishedArticles: vi.fn() }));
vi.mock("@/lib/cms/get-articles", () => ({ getPublishedArticles }));

import { GET } from "./route";

describe("GET /api/news", () => {
  it("returns the four newest published articles", async () => {
    getPublishedArticles.mockResolvedValueOnce([{ id: 1, title: "Vest" }]);
    const response = await GET();
    expect(await response.json()).toEqual([{ id: 1, title: "Vest" }]);
    expect(getPublishedArticles).toHaveBeenCalledWith({ limit: 4 });
  });
});
