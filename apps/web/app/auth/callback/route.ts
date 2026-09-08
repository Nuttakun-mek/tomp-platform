import { NextResponse, type NextRequest } from "next/server";
import { getViewerAccess } from "@/lib/auth/access";
import { getSessionAwareAuthClient } from "@/lib/auth/auth-server";
import { resolveRedirectPath } from "@/lib/auth/role-model";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw === "/" || raw === "/login") return null;
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await getSessionAwareAuthClient();

  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const explicitNext = safeNext(url.searchParams.get("next"));
  if (explicitNext) {
    return NextResponse.redirect(new URL(explicitNext, url.origin));
  }

  const { primaryRole } = await getViewerAccess();
  return NextResponse.redirect(new URL(resolveRedirectPath(primaryRole), url.origin));
}
