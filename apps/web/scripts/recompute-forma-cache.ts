import { recomputeFormaCache } from "@/lib/forma-cache";

async function main() {
  await recomputeFormaCache();
  console.log("Forma cache je ponovo izračunat.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
