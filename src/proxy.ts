import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const VALID_SCOPES = ['srb', 'issf'];
const LOCALE_WITH_REST = /^\/(sr|en)(\/.*)?$/;

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

  // Public site: scope redirect then locale routing, no auth gate.
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/portal")) {
    return scopeRedirect(request) ?? intlMiddleware(request);
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
