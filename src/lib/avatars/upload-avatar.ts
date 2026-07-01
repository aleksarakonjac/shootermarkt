import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const AVATAR_WIDTH = 300;
const AVATAR_HEIGHT = 400;
const BUCKET = "avatars";

// ISSF placeholder is 3.4 KB white JPEG — skip anything under 6 KB
const MIN_BYTES = 6_000;
// Mean channel brightness > 248 = blank/white placeholder
const MAX_MEAN = 248;

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
 * Downloads portrait from sourceUrl, detects ISSF blank placeholder,
 * resizes to 300×400 WebP, uploads to Supabase Storage.
 * Throws NoAvatarError if image is a blank placeholder.
 * Throws Error on network/upload failure — caller should catch and skip.
 */
export async function uploadAvatarFromUrl(
  issfId: string,
  sourceUrl: string,
): Promise<string> {
  // Early out — old domain = no portrait on ISSF
  if (sourceUrl.includes(PLACEHOLDER_DOMAIN)) throw new NoAvatarError("No portrait (old domain)");

  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Portrait fetch failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  // Size check — ISSF placeholder is ~3.4 KB
  if (buffer.byteLength < MIN_BYTES) throw new NoAvatarError("Placeholder (too small)");

  // Brightness check — placeholder is nearly pure white
  const stats = await sharp(buffer).stats();
  const meanBrightness = stats.channels.reduce((s, c) => s + c.mean, 0) / stats.channels.length;
  if (meanBrightness > MAX_MEAN) throw new NoAvatarError("Placeholder (blank white)");

  const webp = await sharp(buffer)
    .resize(AVATAR_WIDTH, AVATAR_HEIGHT, {
      fit: "cover",
      position: "top",
    })
    .webp({ quality: 82 })
    .toBuffer();

  const path = `${issfId}.webp`;
  const supabase = adminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, webp, {
      contentType: "image/webp",
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
