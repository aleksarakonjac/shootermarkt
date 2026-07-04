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

  it("status field denies non-admins from setting status on CREATE, not just update", () => {
    const statusField = Articles.fields?.find(
      (f): f is { name: string; access: { create: (args: { req: ReturnType<typeof fakeReq> }) => unknown } } =>
        "name" in f && f.name === "status"
    );
    expect(statusField!.access.create).toBeDefined();
    expect(statusField!.access.create({ req: fakeReq("author") })).toBe(false);
    expect(statusField!.access.create({ req: fakeReq("admin") })).toBe(true);
  });

  it("author field denies non-admins from setting an arbitrary author id on create or update", () => {
    const authorField = Articles.fields?.find(
      (f): f is {
        name: string;
        access: {
          create: (args: { req: ReturnType<typeof fakeReq> }) => unknown;
          update: (args: { req: ReturnType<typeof fakeReq> }) => unknown;
        };
      } => "name" in f && f.name === "author"
    );
    expect(authorField!.access.create).toBeDefined();
    expect(authorField!.access.update).toBeDefined();
    expect(authorField!.access.create({ req: fakeReq("author") })).toBe(false);
    expect(authorField!.access.create({ req: fakeReq("admin") })).toBe(true);
    expect(authorField!.access.update({ req: fakeReq("author") })).toBe(false);
    expect(authorField!.access.update({ req: fakeReq("admin") })).toBe(true);
  });
});
