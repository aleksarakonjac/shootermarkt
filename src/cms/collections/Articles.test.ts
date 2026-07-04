import { describe, it, expect } from "vitest";
import { Articles } from "./Articles";
import type { CollectionBeforeChangeHook } from "payload";

function fakeReq(role: "admin" | "author" | undefined) {
  return { user: role ? { id: 1, role } : null } as unknown as Parameters<
    NonNullable<CollectionBeforeChangeHook>
  >[0]["req"];
}

describe("Articles collection", () => {
  it("has slug articles", () => {
    expect(Articles.slug).toBe("articles");
  });

  it("defines status options draft, in_review, published", () => {
    const statusField = Articles.fields?.find(
      (f): f is { name: string; options: { value: string }[] } =>
        "name" in f && f.name === "status"
    );
    expect(statusField!.options.map((o) => o.value)).toEqual([
      "draft",
      "in_review",
      "published",
    ]);
  });

  it("read access allows only published articles for anonymous/public requests", () => {
    const readAccess = Articles.access!.read as (args: {
      req: ReturnType<typeof fakeReq>;
    }) => unknown;
    const result = readAccess({ req: fakeReq(undefined) });
    expect(result).toEqual({ status: { equals: "published" } });
  });

  it("read access allows admins to see everything", () => {
    const readAccess = Articles.access!.read as (args: {
      req: ReturnType<typeof fakeReq>;
    }) => unknown;
    const result = readAccess({ req: fakeReq("admin") });
    expect(result).toBe(true);
  });
});
