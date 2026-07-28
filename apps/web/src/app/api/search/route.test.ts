import { describe, expect, it, vi } from "vitest";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("@shootermarkt/db", () => ({ db: { select } }));

import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/search", () => {
  it("skips database work for a one-character query", async () => {
    const response = await GET(new NextRequest("http://localhost/api/search?q=a"));

    expect(await response.json()).toEqual({ shooters: [], competitions: [] });
    expect(select).not.toHaveBeenCalled();
  });
});
