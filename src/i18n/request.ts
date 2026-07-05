import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const VALID_LOCALES = ["sr", "en"] as const;
type Locale = (typeof VALID_LOCALES)[number];

function isValidLocale(v: string): v is Locale {
  return VALID_LOCALES.includes(v as Locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value ?? "sr";
  const locale: Locale = isValidLocale(raw) ? raw : "sr";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
