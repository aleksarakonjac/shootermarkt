# Locale URL-prefix migration — design spec

Date: 2026-07-12

## Problem

Every public page renders fully dynamic in production, defeating all caching (ISR/Full Route Cache), even after `export const revalidate = N` was added to 7 pages. Root cause: `src/i18n/request.ts` calls `cookies()` on every render to resolve `NEXT_LOCALE`. Calling a Next.js dynamic API (`cookies()`, `headers()`) anywhere in the render tree taints the whole route as dynamic, regardless of `revalidate`. This is the actual cause behind "app spor, puno se učitava" on the live Vercel deploy.

## Goal

Move locale resolution from a cookie read to the URL path, so pages can be statically rendered / ISR-cached per locale. `/rangiranje` → `/sr/rangiranje` and `/en/rangiranje`, both real routes, both independently cacheable.

## Decisions (confirmed with user)

- **`localePrefix: 'always'`** — both `sr` and `en` get a URL prefix. No unprefixed public route survives. Existing bare URLs (`/`, `/rangiranje`, `/strelci/29`, `/takmicenja/[id]`, `/vesti/[slug]`, `/kalendar`, `/kontakt`, `/privatnost`) all get a redirect to their `/sr/*` equivalent.
- **`(admin)` route group is excluded.** Stays exactly as-is: no locale prefix, unchanged behavior, unchanged files.
- **Default locale: `sr`.**

## Architecture

### New files
- `middleware.ts` (project root) — next-intl middleware. Locales `['sr', 'en']`, default `sr`, `localePrefix: 'always'`. Matcher must exclude `/admin/**`, `/api/**`, `/cms/**`, `/_next/**`, and static assets (favicon, images, fonts) — those stay outside locale routing entirely.
- `src/i18n/routing.ts` — `defineRouting({ locales: ['sr','en'], defaultLocale: 'sr', localePrefix: 'always' })`. Single source of truth consumed by both middleware and navigation.
- `src/i18n/navigation.ts` — `createNavigation(routing)`, exporting locale-aware `Link`, `redirect`, `usePathname`, `useRouter`. Every internal link inside `(public)` uses this `Link`, not `next/link`, so hrefs auto-prefix without manual string surgery.

### Changed files
- `src/i18n/request.ts` — remove `cookies()` entirely. Resolve locale via `requestLocale` (the value the routing/middleware already resolved), not a runtime API call. This line is the actual fix.
- Route tree: everything currently under `src/app/(site)/(public)/...` moves under `src/app/(site)/[locale]/(public)/...`. `src/app/(site)/(admin)/...` does not move.
- `src/app/(site)/[locale]/layout.tsx` (new, replacing/absorbing current `(public)/layout.tsx` responsibilities) — validates the `locale` param against the known list (404 on garbage), sets `<html lang={locale}>`, wraps children in `NextIntlClientProvider`, adds `generateStaticParams` returning `[{locale:'sr'},{locale:'en'}]`.
- Every `page.tsx` under `(public)` (9 files: home, rangiranje, strelci list+detail, takmicenja list+detail, vesti list+detail, kalendar, kontakt, privatnost) — `Props.params` gains `locale: string` alongside any existing dynamic segment (`id`, `slug`); `await params` destructuring updates accordingly.
- Language switcher component (in `MainNav.tsx` or wherever "EN"/"Prebaci na tamni mod" lives) — replace cookie-set-and-reload with `router.replace(pathname, {locale: newLocale})` from the locale-aware navigation module.
- Every component under `(public)` (and anything shared that's only ever rendered inside `(public)`) that imports `Link` from `next/link` for an *internal* route — swap to the locale-aware `Link` from `src/i18n/navigation.ts`. External links (`<a href="https://...">`) and admin-only components are untouched.

### What stays untouched
- `(admin)` route group: files, behavior, unprefixed URLs, force-dynamic where already present.
- Visual design, data layer, forma algorithm, DB schema.
- `revalidate = 300` already set on 7 pages during the earlier pass — becomes actually effective once this lands, not modified further.

## Redirect / SEO behavior

next-intl's middleware handles the bare-URL → `/sr/*` redirect automatically once `localePrefix: 'always'` is configured — no hand-written redirect map needed. Must verify post-implementation:
- Redirect status code is permanent (308), not a transient 307/302.
- A representative sample of old indexed URLs (`/`, `/rangiranje`, `/strelci/29`, `/takmicenja/47`) correctly 308 to their `/sr/*` counterpart.
- `hreflang` alternate tags are a recommended SEO companion but are lower priority than getting the redirect/caching behavior correct first; can follow in a fast-follow pass if not completed here.

## Verification plan

- `npx next build` — confirm route table; param-driven routes (`/[locale]/rangiranje`, `/[locale]/strelci/[id]`) will still show `ƒ` in the build table (expected — Next can't enumerate every param combo at build time), but that is no longer the signal that matters. The signal that matters: no `cookies()`/`headers()` call remains in the render path for these pages, so the Data Cache and Full Route Cache both work per-URL at request time.
- Manual pass through every public route in both `sr` and `en`, checking: correct locale content, working nav, working locale switcher, working internal links (no accidental un-prefixed hrefs), `(admin)` untouched and still reachable at its original unprefixed path.
- Spot-check redirects: hit 4-5 old bare URLs, confirm 308 → `/sr/*` equivalent.
- `npx tsc --noEmit` clean.
- Existing vitest suite still green (route tests for `/api/cms/*` are outside `(public)`, should be unaffected).

## Explicitly out of scope for this pass

- Sitemap/robots.txt generation (none exist today — not introduced here).
- Full hreflang/canonical metadata pass (noted as recommended fast-follow, not blocking).
- Any change to `(admin)`.
- Any visual/design change.
