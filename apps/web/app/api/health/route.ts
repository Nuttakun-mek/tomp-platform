import { NextResponse } from "next/server";
import { buildInfo } from "@/lib/build-info";
import { readCleanEnv } from "@/lib/env";

function hasServerSupabaseConfig() {
  return Boolean(
    readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") &&
      readCleanEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

function hasUnsafePublicSecret() {
  return Object.keys(process.env).some((key) => key.startsWith("NEXT_PUBLIC_") && /SERVICE|SECRET/i.test(key));
}

export function GET() {
  const unsafePublicSecret = hasUnsafePublicSecret();
  const status = unsafePublicSecret ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      service: "tomp-web",
      checkedAt: new Date().toISOString(),
      version: buildInfo.version,
      updatedAt: buildInfo.updatedAtIso,
      timezone: buildInfo.timezone,
      checks: {
        serverSupabaseConfig: hasServerSupabaseConfig(),
        publicSecretSafe: !unsafePublicSecret,
        webGpsMode: "foreground-browser",
        timelineImmutableUi: true
      }
    },
    { status: unsafePublicSecret ? 503 : 200 }
  );
}
