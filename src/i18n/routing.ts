import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["sr", "en"],
  defaultLocale: "sr",
  localePrefix: "always",
});
