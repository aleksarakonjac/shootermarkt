import { describe, expect, it, vi } from "vitest";

vi.mock("@shootermarkt/db", () => ({ db: { select: vi.fn() } }));

import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/calendar", () => {
  it("rejects an invalid month before querying the database", async () => {
    const response = await GET(new NextRequest("http://localhost/api/calendar?year=2026&month=13"));

    expect(response.status).toBe(400);
  });
});
