const PUBLIC_STORAGE_PREFIX = "/storage/v1/object/public/";
const RENDER_STORAGE_PREFIX = "/storage/v1/render/image/public/";

/**
 * Returns a Supabase Image Transformation URL for a small square avatar.
 * Non-Supabase URLs are returned unchanged so legacy data remains usable.
 */
export function getAvatarThumbnailUrl(avatarUrl: string, size = 48): string {
  try {
    const url = new URL(avatarUrl);

    if (!url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return avatarUrl;

    url.pathname = url.pathname.replace(PUBLIC_STORAGE_PREFIX, RENDER_STORAGE_PREFIX);
    url.searchParams.set("width", String(size));
    url.searchParams.set("height", String(size));
    url.searchParams.set("resize", "cover");

    return url.toString();
  } catch {
    return avatarUrl;
  }
}
