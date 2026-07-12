import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["sr", "en"],
  defaultLocale: "sr",
  localePrefix: "always",
  // Locale comes purely from the URL prefix now — a Set-Cookie on every response
  // makes Vercel treat the page as private and skip the cache entirely.
  localeCookie: false,
});
