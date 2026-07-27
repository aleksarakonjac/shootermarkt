import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const VALID_SCOPES = ['srb', 'issf'];
const LOCALE_WITH_REST = /^\/(sr|en)(\/.*)?$/;
const NO_LOCALE_PREFIX = /^\/(?!sr(?:\/|$)|en(?:\/|$))/;

// Bare paths (no /sr or /en prefix) would otherwise fall through to
// next-intl's Accept-Language negotiation. Prefer the visitor's last choice,
// read from a cookie set client-side on switch (see lib/client-prefs.ts) —
// deliberately not via middleware Set-Cookie, which would make every
// response private and break the Vercel cache.
function preferenceRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!NO_LOCALE_PREFIX.test(pathname)) return null;
  const locale = request.cookies.get('pref_locale')?.value;
  if (locale !== 'sr' && locale !== 'en') return null;
  const rawScope = request.cookies.get('pref_scope')?.value;
  const scope = VALID_SCOPES.includes(rawScope ?? '') ? rawScope : 'srb';
  const rest = pathname === '/' ? '' : pathname;
  return NextResponse.redirect(new URL(`/${locale}/${scope}${rest}`, request.url), 307);
}

function scopeRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const match = pathname.match(LOCALE_WITH_REST);
  if (!match) return null;
  const [, locale, rest = ''] = match;
  const firstSegment = rest.split('/').filter(Boolean)[0];
  if (firstSegment && VALID_SCOPES.includes(firstSegment)) return null;
  const target = rest && rest !== '/' ? `/${locale}/srb${rest}` : `/${locale}/srb`;
  return NextResponse.redirect(new URL(target, request.url), 308);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (/^\/(?:sr|en)\/(?:srb|issf)\/admin\/?$/.test(pathname)) {
    return NextResponse.redirect(new URL("/admin", request.url), 308);
  }

  // Public site: scope redirect then locale routing, no auth gate.
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/portal")) {
    return preferenceRedirect(request) ?? scopeRedirect(request) ?? intlMiddleware(request);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith("/admin") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect /portal routes
  if (request.nextUrl.pathname.startsWith("/portal") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/((?!api|admin|cms|login|_next|_vercel|.*\\..*).*)",
  ],
};
