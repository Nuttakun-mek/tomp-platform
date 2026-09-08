import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

// Guards a project-scoped polling API route: the caller must be signed in.
// Per-project data is already filtered by RLS on the scoped read client, so a
// signed-in non-member gets an empty result rather than a leak.
// Returns a 401 Response to bail with, or null when the request may proceed.
export async function guardProjectApi(): Promise<NextResponse | null> {
  const profile = await getCurrentUserProfile();
  if (!profile.authUserId && !profile.isDevelopmentFallback) {
    return NextResponse.json({ success: false, error: "ต้องเข้าสู่ระบบ" }, { status: 401 });
  }
  return null;
}
