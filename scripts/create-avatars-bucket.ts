import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data, error } = await supabase.storage.createBucket("avatars", {
    public: true,
    fileSizeLimit: 1024 * 1024 * 2, // 2MB — WebP portreti su mali
    allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
  });

  if (error) {
    if (error.message.includes("already exists")) {
      console.log("Bucket 'avatars' već postoji.");
    } else {
      console.error("Greška:", error.message);
      process.exit(1);
    }
  } else {
    console.log("Bucket 'avatars' kreiran:", data);
  }
}

main();
