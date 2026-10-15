"use client";

import { useParams } from "next/navigation";

/**
 * Jezik za deljene komponente koje se koriste i van next-intl providera (admin, glavni
 * layout): čita `[locale]` iz URL-a, a van javnog dela sajta vraća srpski.
 */
export function useUiLocale(): "sr" | "en" {
  const params = useParams<{ locale?: string }>();
  return params?.locale === "en" ? "en" : "sr";
}
