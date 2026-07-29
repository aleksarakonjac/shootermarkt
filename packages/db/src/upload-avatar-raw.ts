import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { decode as decodeJpeg } from "@jsquash/jpeg";
import { init as initJpegDecoder } from "@jsquash/jpeg/decode.js";
import { decode as decodePng } from "@jsquash/png";

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

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

// @jsquash/jpeg's default loader uses browser fetch() to load its .wasm file, which
// Node's fetch doesn't support for file:// URLs. Compile it ourselves once and hand
// it to the decoder's init() — sidesteps that without needing a fetch polyfill.
let jpegReady: Promise<void> | null = null;
function ensureJpegDecoderReady(): Promise<void> {
  if (!jpegReady) {
    jpegReady = (async () => {
      const require = createRequire(import.meta.url);
      // Built from parts at runtime so webpack's static require.resolve() analysis
      // doesn't try to parse this binary as a JS module during the Next build.
      const wasmSubpath = ["@jsquash", "jpeg", "codec", "dec", "mozjpeg_dec.wasm"].join("/");
      const wasmPath = require.resolve(wasmSubpath);
      const wasmModule = await WebAssembly.compile(readFileSync(wasmPath));
      await initJpegDecoder(wasmModule);
    })();
  }
  return jpegReady;
}

/** Mean RGB brightness (0-255) via WASM decode — no native binary, safe for apps/ingest's bundle. */
async function meanBrightness(buffer: Buffer, contentType: string): Promise<number> {
  let imageData;
  if (contentType.includes("png")) {
    imageData = await decodePng(toArrayBuffer(buffer));
  } else {
    await ensureJpegDecoderReady();
    imageData = await decodeJpeg(toArrayBuffer(buffer));
  }
  const { data } = imageData;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i] + data[i + 1] + data[i + 2];
    count += 3;
  }
  return sum / count;
}

/**
 * Sharp-free variant of uploadAvatarFromUrl (see upload-avatar.ts) for apps/ingest,
 * whose Next.js build couldn't reliably bundle sharp's native binary. Uploads the
 * source image as-is — no resize/webp conversion, since avatars are already
 * resized on display via next/image (see strelci/[id]/page.tsx). Blank-placeholder
 * detection uses a WASM JPEG/PNG decoder (portable bytecode, no platform-specific
 * native binary risk) instead of sharp's pixel stats.
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

  try {
    const mean = await meanBrightness(buffer, contentType);
    if (mean > MAX_MEAN) throw new NoAvatarError("Placeholder (blank white)");
  } catch (error) {
    if (error instanceof NoAvatarError) throw error;
    // Decode failed (unsupported variant) — fall back to the size check only.
  }

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
