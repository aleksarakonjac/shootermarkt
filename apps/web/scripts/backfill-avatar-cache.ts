// Jednokratno: postojeći avatari su upload-ovani sa podrazumevanim Cache-Control max-age=3600, pa ih browseri
// i Supabase CDN ponovo vuku svakog sata (Supabase egress). Header dolazi iz samog objekta, ne iz storage.objects
// metadata kolone, zato se svaki fajl skida i ponovo upload-uje sa godišnjim cacheControl-om (isti put, isti sadržaj).
// Idempotentno: preskače objekte koji već imaju novi cacheControl. Pokretanje: pnpm db:backfill-avatar-cache
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "avatars";
const CACHE_CONTROL = "31536000";
// 8 je iscrpelo konekcije Storage API-ja ka bazi ("Too many connections") — i sajt deli tu bazu.
const CONCURRENCY = 2;

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const rows = await sql<{ name: string; mimetype: string | null }[]>`
    select name, metadata->>'mimetype' as mimetype from storage.objects
    where bucket_id = ${BUCKET} and coalesce(metadata->>'cacheControl', '') <> ${`max-age=${CACHE_CONTROL}`}
    order by name`;
  console.log(`${rows.length} avatara za ažuriranje`);

  let done = 0;
  const failed: string[] = [];
  const queue = [...rows];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      let message: string | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.storage.from(BUCKET).download(row.name);
        const upload = data && await supabase.storage.from(BUCKET).upload(row.name, data, {
          upsert: true,
          contentType: row.mimetype ?? data.type,
          cacheControl: CACHE_CONTROL,
        });
        message = error || !upload || upload.error ? (error ?? upload?.error)?.message ?? "unknown" : undefined;
        if (!message) break;
        await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
      }
      if (message) failed.push(`${row.name}: ${message}`);
      if (++done % 500 === 0) console.log(`${done}/${rows.length}`);
    }
  }));

  console.log(`Gotovo: ${done - failed.length} ok, ${failed.length} grešaka`);
  for (const f of failed.slice(0, 20)) console.log("  " + f);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
