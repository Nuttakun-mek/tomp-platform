import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPublicPath } from "@/lib/auth/public-paths";

// The Edge runtime cannot use lib/env's readCleanEnv (it touches the filesystem),
// but it must sanitise identically: a stray quote or trailing space on a Vercel
// env var would build a Supabase client with a bad key here while every server
// component — which does go through readCleanEnv — gets a working one. That
// mismatch logs the viewer out in middleware and straight back in on the page,
// which is an infinite redirect and a white screen.
function cleanEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw == null) continue;
    // trim() already strips a leading BOM — U+FEFF is whitespace in JS.
    const value = raw.trim().replace(/^['"]|['"]$/g, "").trim();
    if (value) return value;
  }
  return undefined;
}

const SUPABASE_URL_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"] as const;
const SUPABASE_ANON_KEYS = ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"] as const;
const LOCALE_COOKIE = "tomp_locale";
const SUPPORTED_LOCALES = new Set(["th", "en"]);

function requestLocale(request: NextRequest): "th" | "en" | null {
  const value = request.nextUrl.searchParams.get("lang");
  return SUPPORTED_LOCALES.has(value || "") ? (value as "th" | "en") : null;
}

function withLocaleCookie(request: NextRequest, response: NextResponse, locale: "th" | "en" | null) {
  if (locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
      path: "/"
    });
  }
  return response;
}

function isAuthConfigured() {
  return Boolean(cleanEnv(...SUPABASE_URL_KEYS) && cleanEnv(...SUPABASE_ANON_KEYS));
}

export async function middleware(request: NextRequest) {
  const locale = requestLocale(request);
  const requestHeaders = new Headers(request.headers);
  if (locale) requestHeaders.set("x-tomp-locale", locale);

  if (isPublicPath(request.nextUrl.pathname)) {
    return withLocaleCookie(request, NextResponse.next({ request: { headers: requestHeaders } }), locale);
  }

  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV !== "production") return withLocaleCookie(request, NextResponse.next({ request: { headers: requestHeaders } }), locale);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "missing-auth-config");
    return withLocaleCookie(request, NextResponse.redirect(url), locale);
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(cleanEnv(...SUPABASE_URL_KEYS)!, cleanEnv(...SUPABASE_ANON_KEYS)!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data, error } = await supabase.auth.getUser().catch((cause) => ({ data: { user: null }, error: cause }));

  // Only bounce when Supabase positively says there is no session. If the check
  // itself failed (network blip, misconfigured key) let the request through —
  // the page still enforces via getCurrentUserProfile()/requirePermission(), and
  // treating "could not verify" as "logged out" is what produced the redirect
  // loop between this file and app/login/page.tsx.
  if (!data?.user && !error) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return withLocaleCookie(request, NextResponse.redirect(url), locale);
  }

  return withLocaleCookie(request, response, locale);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
