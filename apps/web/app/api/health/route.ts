import { NextResponse } from "next/server";
import { buildInfo } from "@/lib/build-info";
import { readCleanEnv } from "@/lib/env";
import { scopedReadsFlagOn } from "@/lib/supabase/scoped-decision";

function hasServerSupabaseConfig() {
  return Boolean(
    readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") &&
      readCleanEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

function hasUnsafePublicSecret() {
  return Object.keys(process.env).some((key) => key.startsWith("NEXT_PUBLIC_") && /SERVICE|SECRET/i.test(key));
}

function getBuildStamp() {
  const iso = process.env.NEXT_PUBLIC_BUILD_TIME || buildInfo.updatedAtIso;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return {
      version: buildInfo.version,
      updatedAt: buildInfo.updatedAtIso,
      updatedAtText: buildInfo.updatedAtText
    };
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";

  return {
    version: `${part("year")}.${part("month")}.${part("day")}.${part("hour")}${part("minute")}`,
    updatedAt: iso,
    updatedAtText: `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")} น.`
  };
}

export function GET() {
  const unsafePublicSecret = hasUnsafePublicSecret();
  const status = unsafePublicSecret ? "degraded" : "ok";
  const stamp = getBuildStamp();

  return NextResponse.json(
    {
      status,
      service: "tomp-web",
      checkedAt: new Date().toISOString(),
      version: stamp.version,
      updatedAt: stamp.updatedAt,
      updatedAtText: stamp.updatedAtText,
      timezone: buildInfo.timezone,
      checks: {
        serverSupabaseConfig: hasServerSupabaseConfig(),
        publicSecretSafe: !unsafePublicSecret,
        // Safe boolean only — never the raw env value. false means reads fall
        // back to service-role transport and RLS is not exercised.
        scopedReadsEnabled: scopedReadsFlagOn(),
        webGpsMode: "foreground-browser",
        timelineImmutableUi: true
      }
    },
    { status: unsafePublicSecret ? 503 : 200 }
  );
}
