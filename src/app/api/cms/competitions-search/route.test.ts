import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () =>
              Promise.resolve([{ id: 1, name: "Prvenstvo Srbije 2026", date: "2026-05-01" }]),
          }),
        }),
      }),
    }),
  },
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/cms/competitions-search", () => {
  it("returns matching competitions as JSON", async () => {
    const req = new NextRequest("http://localhost/api/cms/competitions-search?q=umjetstvo");
    const res = await GET(req);
    const body = await res.json();
    expect(body).toEqual([{ id: 1, name: "Prvenstvo Srbije 2026", date: "2026-05-01" }]);
  });
});
