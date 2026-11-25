import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

const inserted = vi.hoisted(() => [] as Array<{ nationality: string | null }>);

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => null }));
vi.mock("@/lib/revalidate-public", () => ({ revalidatesPublicSite: (handler: unknown) => handler }));
vi.mock("@shootermarkt/db/upload-avatar", () => ({ uploadAvatarFromUrl: vi.fn() }));
vi.mock("@shootermarkt/adapters/issf/adapter", () => ({
  fetchAthleteProfile: async () => ({ firstName: "Yanise", familyName: "TORIN", nationCode: "FRA" }),
  inferApparatus: () => null,
}));
vi.mock("@shootermarkt/db", () => ({
  db: {
    insert: () => ({
      values: (value: { nationality: string | null }) => {
        inserted.push(value);
        return { onConflictDoNothing: () => ({ returning: async () => [{ id: 1 }] }) };
      },
    }),
  },
}));

import { POST } from "./route";

const importOne = (nationCode?: string) =>
  POST(new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify({ issfId: "SHFRAW1012197601", nationCode }) }));

it("takes the nation from the results, ISSF profile only as a fallback", async () => {
  await importOne("GLP");
  await importOne("BAY");
  await importOne("");
  expect(inserted.map((s) => s.nationality)).toEqual(["GLP", "GER", "FRA"]);
});
