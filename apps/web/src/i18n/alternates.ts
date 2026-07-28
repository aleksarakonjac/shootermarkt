import { getPathname } from "./navigation";
import { routing } from "./routing";
import type { Scope } from "@/lib/scope";

/**
 * Builds `alternates.languages` (+ self-referencing canonical) for a route so search
 * engines know /sr/* and /en/* are the same content in different languages, not duplicates.
 */
export function buildAlternates(
  currentLocale: string,
  scope: Scope,
  pathname: string
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = getPathname({ locale, href: `/${scope}${pathname}` });
  }
  languages["x-default"] = languages[routing.defaultLocale];

  return { canonical: languages[currentLocale] ?? languages[routing.defaultLocale], languages };
}
