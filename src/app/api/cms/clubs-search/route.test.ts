import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([{ id: 1, name: "SK Pančevo 1813", city: "Pančevo" }]),
          }),
        }),
      }),
    }),
  },
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/cms/clubs-search", () => {
  it("returns matching clubs as JSON", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cms/clubs-search?q=pancevo"));
    expect(await res.json()).toEqual([{ id: 1, name: "SK Pančevo 1813", city: "Pančevo" }]);
  });

  it("does not search before two characters", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cms/clubs-search?q=p"));
    expect(await res.json()).toEqual([]);
  });
});
