import { NextResponse, type NextRequest } from "next/server";
import { getSessionAwareAuthClient } from "@/lib/auth/auth-server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";
  const supabase = await getSessionAwareAuthClient();

  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", requestUrl.origin));
}
