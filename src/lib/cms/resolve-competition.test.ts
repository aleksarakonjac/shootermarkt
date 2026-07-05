import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      competitions: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { db } from "@/lib/db";
import { resolveCompetition } from "./resolve-competition";

describe("resolveCompetition", () => {
  it("returns null when the competition does not exist", async () => {
    (db.query.competitions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const result = await resolveCompetition(999999);
    expect(result).toBeNull();
  });

  it("returns competition card data when found", async () => {
    (db.query.competitions.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1,
      name: "Prvenstvo Srbije 2026",
      date: "2026-05-01",
      dateEnd: null,
      location: "Beograd",
      level: "national",
    });
    const result = await resolveCompetition(1);
    expect(result).toEqual({
      id: 1,
      name: "Prvenstvo Srbije 2026",
      date: "2026-05-01",
      dateEnd: null,
      location: "Beograd",
      level: "national",
    });
  });
});
