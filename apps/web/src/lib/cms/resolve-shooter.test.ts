import { describe, it, expect, vi } from "vitest";

vi.mock("@shootermarkt/db", () => ({
  db: {
    query: {
      shooters: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      }),
    })),
  },
}));

import { db } from "@shootermarkt/db";
import { resolveShooter } from "./resolve-shooter";

describe("resolveShooter", () => {
  it("returns null when the shooter does not exist", async () => {
    (db.query.shooters.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const result = await resolveShooter(999999);
    expect(result).toBeNull();
  });

  it("returns shooter card data (without forma) when found but has no results", async () => {
    (db.query.shooters.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 5,
      firstName: "Petar",
      lastName: "Petrović",
      avatarUrl: null,
      nationality: "SRB",
      club: { name: "SK Pančevo 1813" },
    });
    const result = await resolveShooter(5);
    expect(result).toEqual({
      id: 5,
      firstName: "Petar",
      lastName: "Petrović",
      avatarUrl: null,
      nationality: "SRB",
      clubName: "SK Pančevo 1813",
      forma: null,
      disciplineCode: null,
    });
  });
});
