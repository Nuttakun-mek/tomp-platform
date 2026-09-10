import { NextResponse } from "next/server";
import { resolveDriverSession } from "@/lib/api/driver-token";
import { saveMobileSessionPushToken } from "@/lib/driver-access/mobile-session";

// The native shell posts its Expo push token here so dispatch can reach the
// driver while the app is backgrounded. The assignment/project it belongs to
// comes from the signed session, never from the request body.
export async function POST(request: Request) {
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const platform = typeof body?.platform === "string" ? body.platform.trim().slice(0, 20) : "unknown";

  // Expo tokens look like ExponentPushToken[xxxxxxxx] — reject anything else so
  // a bad value cannot be stored and retried forever.
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) {
    return NextResponse.json({ success: false, error: "push token ไม่ถูกต้อง" }, { status: 400 });
  }

  const saved = await saveMobileSessionPushToken(auth.context, token, platform);
  if (!saved) return NextResponse.json({ success: false, error: "บันทึก push token ไม่สำเร็จ" }, { status: 503 });

  return NextResponse.json({ success: true });
}
