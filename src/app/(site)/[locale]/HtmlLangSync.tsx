"use client";

import { useEffect } from "react";

/** Root <html lang> is static (defaultLocale) so the root layout stays cache-safe.
 * This patches it client-side to the real locale — cheap, runs once on mount. */
export function HtmlLangSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
