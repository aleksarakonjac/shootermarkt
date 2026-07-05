import { describe, it, expect } from "vitest";
import { CmsUsers } from "./CmsUsers";

describe("CmsUsers collection", () => {
  it("has slug cms-users", () => {
    expect(CmsUsers.slug).toBe("cms-users");
  });

  it("defines a role field with admin and author options", () => {
    const roleField = CmsUsers.fields?.find(
      (f): f is { name: string; type: string; options: { value: string }[] } =>
        "name" in f && f.name === "role"
    );
    expect(roleField).toBeDefined();
    const values = roleField!.options.map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["admin", "author"]));
  });
});
