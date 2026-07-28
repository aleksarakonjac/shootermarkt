import { createClient } from "@supabase/supabase-js";
import { PDF_IMPORT_BUCKET } from "@shootermarkt/adapters/pdf-import/storage";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data, error } = await supabase.storage.createBucket(PDF_IMPORT_BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  });

  if (error) {
    if (error.message.includes("already exists")) {
      console.log(`Bucket '${PDF_IMPORT_BUCKET}' već postoji.`);
      return;
    }
    throw new Error(error.message);
  }
  console.log(`Bucket '${PDF_IMPORT_BUCKET}' kreiran:`, data);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
