# Scope URL Segment Migration Plan

## Cilj

Uvesti `[scope]` kao URL segment, paralelno sa `[locale]`, kako bi svaki scope imao odvojen ISR cache entry na Vercel-u i čiste, deljive URL-ove.

```
Staro:  /sr/takmicenja         (scope u cookie/localStorage)
Novo:   /sr/srb/takmicenja     (SRB scope)
        /sr/issf/takmicenja    (ISSF scope)
```

---

## Scopeovi (MVP)

| Slug | Naziv | Opis |
|---|---|---|
| `srb` | Srbija | Srpska takmičenja + ESC + ISSF, samo SRB strelci |
| `issf` | ISSF / Globalno | Samo continental/world/olympic nivo, svi strelci u bazi |

Budući (ne implementirati sad): `de`, `hu`, `at`, itd.

---

## Nova File Struktura

```
src/app/(site)/[locale]/(public)/
  layout.tsx                        ← header/footer, NE menja se (scope-agnostičan)
  [scope]/                          ← NOVI segment
    layout.tsx                      ← validacija scope-a, generateStaticParams
    page.tsx                        ← homepage (scope-aware)
    takmicenja/
      page.tsx
      [id]/
        page.tsx
        CompetitionResultsClient.tsx
    strelci/
      page.tsx
      StrelciFilterBar.tsx
      [id]/
        page.tsx
    rangiranje/
      page.tsx
      HeadToHeadPanel.tsx
    vesti/
      page.tsx
      [slug]/
        page.tsx
    kontakt/
      page.tsx
    privatnost/
      page.tsx
    quick-h2h-client.tsx
    top-forma-client.tsx
    search-bar-client.tsx
    actions.ts
    homepage.css
    GlobalSearch.tsx                ← ostaje u (public)/ (koristi layout)
    ticker.tsx                      ← ostaje u (public)/
    components/                     ← ostaje u (public)/components/
```

Fajlovi koji OSTAJU na trenutnoj lokaciji (nisu scope-zavisni):
- `(public)/layout.tsx` — header/footer wrapper
- `(public)/components/*` — MainNav, RegionSelector, LocaleSwitcher, itd.
- `(public)/GlobalSearch.tsx` — globalna pretraga
- `(public)/ticker.tsx`
- `(public)/kalendar/` — samo redirect na takmicenja, nema scopea

---

## Novi URL-ovi

| Stari URL | Novi URL |
|---|---|
| `/sr` | `/sr/srb` (redirect) |
| `/sr/takmicenja` | `/sr/srb/takmicenja` (redirect) |
| `/sr/takmicenja/123` | `/sr/srb/takmicenja/123` (redirect) |
| `/sr/strelci` | `/sr/srb/strelci` (redirect) |
| `/sr/strelci/456` | `/sr/srb/strelci/456` (redirect) |
| `/sr/rangiranje` | `/sr/srb/rangiranje` (redirect) |
| `/sr/vesti` | `/sr/srb/vesti` (redirect) |
| `/sr/kontakt` | `/sr/srb/kontakt` (redirect) |
| `/sr/privatnost` | `/sr/srb/privatnost` (redirect) |

Redirecti: permanentni (308) osim homepage koji može biti 307 (možda korisnik želi ISSF po defaultu u budućnosti).

---

## Novi Fajlovi Koje Treba Kreirati

### 1. `src/lib/scope.ts` — Scope konstante i DB filteri

```typescript
export type Scope = 'srb' | 'issf';
export const VALID_SCOPES: Scope[] = ['srb', 'issf'];
export const DEFAULT_SCOPE: Scope = 'srb';

// Nivoi takmičenja koji se prikazuju po scopeu
export const ISSF_LEVELS = ['continental', 'world', 'olympic'] as const;

// SQL filter za takmičenja po scopeu
// (prima Drizzle sql/or/and helper-e kao argument zbog čistoće)
export function buildCompetitionScopeFilter(scope: Scope) { ... }

// Filter za strelce po scopeu  
export function buildShooterScopeFilter(scope: Scope) { ... }
```

### 2. `src/app/(site)/[locale]/(public)/[scope]/layout.tsx`

```typescript
import { notFound } from 'next/navigation';
import { VALID_SCOPES } from '@/lib/scope';

export function generateStaticParams() {
  return VALID_SCOPES.map(scope => ({ scope }));
}

export default async function ScopeLayout({ children, params }) {
  const { scope } = await params;
  if (!VALID_SCOPES.includes(scope)) notFound();
  return <>{children}</>;
}
```

**Napomena**: `revalidate = 300` se može staviti ovde umesto na svakoj stranici.

---

## Izmene Postojećih Fajlova

### `src/proxy.ts` (middleware) — Redirecti starih URL-ova

Dodati redirect logiku pre intl middleware-a:

```typescript
// /sr → /sr/srb, /en → /en/srb
// /sr/takmicenja → /sr/srb/takmicenja
// itd.
```

Pattern: ako pathname posle locale-a ne počinje sa validnim scopeom → redirect na `/[locale]/srb/[rest]`.

### `src/i18n/routing.ts` — Nema izmena u routing konfiguraciji

Scope nije deo next-intl routing-a, to je obični Next.js dinamički segment.

### `src/i18n/navigation.ts` — Nema izmena

### `src/i18n/alternates.ts` — Ažurirati `buildAlternates`

Mora da uključuje scope u pathname:

```typescript
// Staro: buildAlternates(locale, "/takmicenja")
// Novo:  buildAlternates(locale, scope, "/takmicenja")
// Output: /sr/srb/takmicenja, /en/srb/takmicenja
```

### `src/app/(site)/[locale]/(public)/layout.tsx` — Scope u params

Treba primiti scope iz params da ga prosledi RegionSelector-u:

```typescript
// params sada: Promise<{ locale: string; scope: string }>
// prosledi scope u RegionSelector
```

### `src/app/(site)/[locale]/(public)/components/RegionSelector.tsx` — Migracija na URL navigaciju

- Ukloni `localStorage` i `document.cookie` logiku
- Čita trenutni scope iz `useParams().scope`
- Navigira na `/[locale]/[noviScope]/[trenutniPath]` kad korisnik menja scope
- Koristi `useRouter` + `usePathname` iz `@/i18n/navigation`

```typescript
// Pseudokod:
const { scope } = useParams();
const router = useRouter();
const pathname = usePathname(); // /takmicenja (bez locale i scope)

function select(newScope: Scope) {
  router.push(`/${newScope}${pathname}`, { locale });
  // ili konstruisati URL direktno
}
```

**Problem**: `usePathname` iz next-intl vraća path bez locale prefiksa, ali SA scope segmentom (npr. `/srb/takmicenja`). Treba strip-ovati scope prefix.

Rešenje: koristiti `useParams` da dobiješ scope, i ukloniti ga iz pathname pre navigacije.

### `src/app/(site)/[locale]/(public)/components/MainNav.tsx` — Scope-aware linkovi

Trenutni nav linkovi su hard-coded (`href="/strelci"`). Sa scope-om:

```typescript
// Opcija A: hook koji dodaje scope prefix
const { scope } = useScopeParams(); // custom hook
<Link href={`/${scope}/strelci`}>Strelci</Link>

// Opcija B: nav-links.tsx prima scope kao prop
```

Preporuka: **custom `useScopedHref` hook** koji čita scope iz `useParams` i gradi href.

### `src/app/(site)/[locale]/(public)/nav-links.tsx` — Ažurirati

Linkovi treba da koriste `useScopedHref` ili prihvataju scope kao prop.

### `src/app/(site)/(admin)/admin/ticker/page.tsx` — Proveriti import

Već je bio problematičan u locale migraciji — proveriti posle.

---

## Scope-specifičan sadržaj po stranici

### Homepage (`[scope]/page.tsx`)
- **SRB**: Nadolazeća srpska + ESC takmičenja, top forma SRB strelaca
- **ISSF**: Nadolazeća continental/world/olympic takmičenja, top forma svih strelaca

### Takmičenja (`[scope]/takmicenja/page.tsx`)
- **SRB**: `buildCompetitionScopeFilter('srb')` u SQL
- **ISSF**: `buildCompetitionScopeFilter('issf')` u SQL

### Takmičenje detalj (`[scope]/takmicenja/[id]/page.tsx`)
- Scope ne menja šta se prikazuje (konkretno takmičenje)
- Ali URL mora biti scope-aware radi konzistentnosti navigacije

### Strelci (`[scope]/strelci/page.tsx`)
- **SRB**: samo strelci sa srpskim klubom ili nacionalnošću (MVP: svi verified strelci)
- **ISSF**: svi verified strelci u bazi

### Strelac detalj (`[scope]/strelci/[id]/page.tsx`)
- Scope uglavnom ne menja sadržaj (profil konkretnog strelca)
- Back link i navigacija scope-aware

### Rangiranje (`[scope]/rangiranje/page.tsx`)
- **SRB**: rangiranje filtrira samo SRB strelce
- **ISSF**: rangiranje svih strelaca u bazi

### Vesti, Kontakt, Privatnost
- Scope-agnostičan sadržaj
- URL ima scope radi konzistentnosti (korisnik ostaje u svom scopeu)
- DB query-ji ignorišu scope

---

## `generateStaticParams` strategija

Svaki page koji je scope-dependant treba:

```typescript
// [scope]/takmicenja/page.tsx
export function generateStaticParams() {
  return routing.locales.flatMap(locale =>
    VALID_SCOPES.map(scope => ({ locale, scope }))
  );
  // Rezultat: sr/srb, sr/issf, en/srb, en/issf
}
```

Za dynamic routes kao `[scope]/takmicenja/[id]`:

```typescript
export async function generateStaticParams() {
  const comps = await db.select({ id: competitions.id }).from(competitions);
  return routing.locales.flatMap(locale =>
    VALID_SCOPES.flatMap(scope =>
      comps.map(c => ({ locale, scope, id: String(c.id) }))
    )
  );
}
```

**Napomena**: za `[id]` stranice, pre-generisanje svih kombinacija može biti skupo. Alternativa: `dynamicParams = true` + `revalidate = 300` (on-demand ISR za first hit).

---

## Redirect Logika u `proxy.ts`

```typescript
// Posle intl middleware-a već dodate locale prefixe
// Treba dodati scope ako fali

const SCOPE_SEGMENT = /^\/(sr|en)\/(srb|issf)\//;
const LOCALE_ONLY   = /^\/(sr|en)(\/.*)?$/;

// Ako URL ima locale ali nema scope → redirect na /locale/srb/rest
if (LOCALE_ONLY.test(pathname) && !SCOPE_SEGMENT.test(pathname)) {
  const [, locale, rest = ''] = pathname.match(/^\/(sr|en)(\/.*)?$/) ?? [];
  return NextResponse.redirect(new URL(`/${locale}/srb${rest || '/'}`, request.url), 308);
}
```

**Redosled u proxy.ts**: scope redirect BEFORE intl middleware.

---

## Caching rezultat

Posle migracije, svaka javna stranica imaće:
- `export const revalidate = 300` (ili nasljeđeno iz `[scope]/layout.tsx`)
- ISR cache po URL-u: `/sr/srb/takmicenja` i `/sr/issf/takmicenja` = odvojeni cache entryji
- Vercel Full Route Cache → `x-vercel-cache: HIT` posle prvog requesta
- Build pre-generisanje: 4 kombosa po stranici (sr×en × srb×issf)

---

## Redosled Implementacije

### Faza 1 — Osnova (bez fajl pomeranja)
- [ ] Kreirati `src/lib/scope.ts` sa tipovima i DB filter funkcijama
- [ ] Kreirati `[scope]/layout.tsx` sa validacijom i `generateStaticParams`
- [ ] Ažurirati `proxy.ts` sa redirect logikom za stare URL-ove
- [ ] Kreirati `useScopedHref` hook (ili scope-aware nav util)

### Faza 2 — Preseliti stranice
- [ ] Preseliti `(public)/page.tsx` → `(public)/[scope]/page.tsx`
- [ ] Preseliti `(public)/takmicenja/` → `(public)/[scope]/takmicenja/`
- [ ] Preseliti `(public)/strelci/` → `(public)/[scope]/strelci/`
- [ ] Preseliti `(public)/rangiranje/` → `(public)/[scope]/rangiranje/`
- [ ] Preseliti `(public)/vesti/` → `(public)/[scope]/vesti/`
- [ ] Preseliti `(public)/kontakt/` → `(public)/[scope]/kontakt/`
- [ ] Preseliti `(public)/privatnost/` → `(public)/[scope]/privatnost/`
- [ ] Preseliti helper fajlove (`quick-h2h-client.tsx`, `top-forma-client.tsx`, `actions.ts`, `homepage.css`)

### Faza 3 — Scope-aware DB queriji
- [x] `takmicenja/page.tsx`: koristiti `buildCompetitionScopeFilter(scope)` umesto cookie
- [x] `strelci/page.tsx`: koristiti `buildShooterScopeFilter(scope)`
- [x] `rangiranje/page.tsx`: filtrirati kandidate po scopeu
- [x] `page.tsx` (homepage): scope-aware upcoming + top forma
- [x] Ukloniti sve `cookies()` scope pozive

### Faza 4 — Navigacija i RegionSelector
- [x] Repisati `RegionSelector.tsx` — URL navigacija umesto cookie
- [x] Ažurirati `MainNav.tsx` — scope-aware linkovi
- [x] Ažurirati `nav-links.tsx`
- [x] Ažurirati `(public)/layout.tsx` — proslediti scope u RegionSelector
- [x] Ažurirati `buildAlternates` u `alternates.ts` — uključiti scope

### Faza 5 — Cleanup
- [x] Ukloniti `localStorage` i `document.cookie` iz `RegionSelector.tsx`
- [x] Ukloniti `force-dynamic` i `cookies()` import iz `takmicenja/page.tsx`
- [x] Proveriti `admin/ticker/page.tsx` import (bio je problematičan ranije)
- [x] Proveriti sve `Link` hrefs da nema hardcoded ruta bez scope-a
- [ ] Verifikovati Vercel build: `next build` bez grešaka, sve stranice `●` Static ili `○` ISR

---

## Poznate Zamke

1. **`usePathname` u RegionSelector vraća path SA scope segmentom** (npr. `/srb/takmicenja`). Treba strip-ovati scope prefix pre navigacije u novi scope.

2. **`generateStaticParams` u `[locale]/layout.tsx` i `[scope]/layout.tsx` su odvojeni**. Next.js kombinuje ih automatski za nested dynamic segmente — ne treba ih eksplicitno crossovati.

3. **`getPathname` iz next-intl** za `buildAlternates` ne zna za scope — treba ga ručno dodati u href.

4. **Admin panel** (`/admin/*`) nema scope i ne treba mu. `proxy.ts` redirect mora isključiti `/admin`, `/portal`, `/api` putanje.

5. **Kalendar page** (`/kalendar`) je samo redirect na `/takmicenja?view=cal` — posle migracije treba da bude `/[scope]/takmicenja?view=cal`.

6. **`GlobalSearch`** u layoutu fetchuje listu takmičenja bez scope filtera (radi search po svemu). To je OK — search je scope-agnostičan. Linkovi u search rezultatima moraju biti scope-aware.

---

## Work Log

### 2026-07-12
- Napisao arhitekturalni plan i redosled implementacije
- Repo stanje pre migracije: commit `b429185` (fix LocaleSwitcher Suspense)
- Prethodni relacioni rad: locale URL prefix migracija kompletna (`/sr/*`, `/en/*`)

---

_Nastavi od "Faza 1" u sledećoj sesiji. Sve faze su nezavisne i mogu se commitovati zasebno._
