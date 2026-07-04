import { describe, it, expect } from "vitest";
import { Media } from "./Media";

describe("Media collection", () => {
  it("has slug media", () => {
    expect(Media.slug).toBe("media");
  });

  it("is configured as an upload collection with image resize sizes", () => {
    expect(Media.upload).toBeTruthy();
    expect(typeof Media.upload).toBe("object");
    const upload = Media.upload as { imageSizes?: { name: string }[] };
    expect(upload.imageSizes?.map((s) => s.name)).toEqual(
      expect.arrayContaining(["thumbnail", "card"])
    );
  });

  it("has an alt text field", () => {
    const altField = Media.fields?.find((f) => "name" in f && f.name === "alt");
    expect(altField).toBeDefined();
  });
});
