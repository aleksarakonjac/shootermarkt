import { setRequestLocale } from "next-intl/server";

// Svaki page i generateMetadata renderuje se u svom kontekstu, pa setRequestLocale iz layout-a
// ne važi za njih. Bez ovoga next-intl čita headers() i ruta postaje dinamička (revalidate se ne
// primenjuje). Pozvati pre bilo kog getLocale/getTranslations.
export async function pageParams<P extends { locale: string }>(params: Promise<P>): Promise<P> {
  const resolved = await params;
  setRequestLocale(resolved.locale);
  return resolved;
}
