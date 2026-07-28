import { describe, expect, it } from "vitest";
import { getAvatarThumbnailUrl } from "./avatar-url";

describe("getAvatarThumbnailUrl", () => {
  it("uses Supabase Image Transformations for public storage avatars", () => {
    expect(
      getAvatarThumbnailUrl(
        "https://project.supabase.co/storage/v1/object/public/avatars/SHAFGM0906199701.webp",
      ),
    ).toBe(
      "https://project.supabase.co/storage/v1/render/image/public/avatars/SHAFGM0906199701.webp?width=48&height=48&resize=cover",
    );
  });

  it("preserves non-Supabase URLs", () => {
    const avatarUrl = "https://example.com/avatar.webp";
    expect(getAvatarThumbnailUrl(avatarUrl)).toBe(avatarUrl);
  });
});
