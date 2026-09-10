import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PREFIXES = ["/login", "/no-access", "/auth/callback", "/driver", "/api/driver", "/api/health", "/_next", "/favicon.ico"];

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

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthConfigured() {
  return Boolean(cleanEnv(...SUPABASE_URL_KEYS) && cleanEnv(...SUPABASE_ANON_KEYS));
}

export async function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "missing-auth-config");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(cleanEnv(...SUPABASE_URL_KEYS)!, cleanEnv(...SUPABASE_ANON_KEYS)!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
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
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
