import { createClient } from "@supabase/supabase-js";

export const PDF_IMPORT_BUCKET = "pdf-imports";

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function uploadPdfImport(path: string, pdf: Buffer) {
  const { error } = await storageClient().storage
    .from(PDF_IMPORT_BUCKET)
    .upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`PDF upload nije uspeo: ${error.message}`);
}

export async function downloadPdfImport(path: string): Promise<Buffer> {
  const { data, error } = await storageClient().storage.from(PDF_IMPORT_BUCKET).download(path);
  if (error || !data) throw new Error(`PDF preuzimanje nije uspelo: ${error?.message ?? "fajl nije pronađen"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function removePdfImports(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await storageClient().storage.from(PDF_IMPORT_BUCKET).remove(paths);
  if (error) throw new Error(`Brisanje PDF-ova nije uspelo: ${error.message}`);
}
