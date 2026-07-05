import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () =>
                Promise.resolve([
                  { id: 5, firstName: "Petar", lastName: "Petrović", clubName: "SK Pančevo 1813" },
                ]),
            }),
          }),
        }),
      }),
    }),
  },
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/cms/shooters-search", () => {
  it("returns matching shooters as JSON", async () => {
    const req = new NextRequest("http://localhost/api/cms/shooters-search?q=petro");
    const res = await GET(req);
    const body = await res.json();
    expect(body).toEqual([
      { id: 5, firstName: "Petar", lastName: "Petrović", clubName: "SK Pančevo 1813" },
    ]);
  });
});
