import { createClient } from "@supabase/supabase-js";

const BUCKET = "avatars";

// ISSF placeholder is 3.4 KB white JPEG — skip anything under 6 KB
const MIN_BYTES = 6_000;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export class NoAvatarError extends Error {}

// Athletes without portraits get a URL from this old ISSF domain — skip immediately
const PLACEHOLDER_DOMAIN = "result.issf-sports.info";

/**
 * Sharp-free variant of uploadAvatarFromUrl (see upload-avatar.ts) for use where
 * sharp's native binary can't be reliably bundled (apps/ingest — see
 * docs/ or commit history for the Next.js output-tracing issue that forced this
 * split). Uploads the source image as-is: no resize/webp conversion, no
 * brightness-based blank-placeholder detection (only the byte-size check applies).
 * TODO: replace with a shared resize path once the sharp bundling issue is fixed.
 */
export async function uploadAvatarFromUrlRaw(
  issfId: string,
  sourceUrl: string,
): Promise<string> {
  if (sourceUrl.includes(PLACEHOLDER_DOMAIN)) throw new NoAvatarError("No portrait (old domain)");

  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Portrait fetch failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.byteLength < MIN_BYTES) throw new NoAvatarError("Placeholder (too small)");

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `${issfId}.${ext}`;
  const supabase = adminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
