import { NextResponse } from "next/server";
import { exchangeMobileSessionChallenge } from "@/lib/driver-access/mobile-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: unknown; installationId?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const installationId = typeof body?.installationId === "string" ? body.installationId.trim() : "";

  if (!code || !installationId) {
    return NextResponse.json({ success: false, error: "ข้อมูลสำหรับแลก mobile session ไม่ครบ" }, { status: 400 });
  }

  try {
    const exchanged = await exchangeMobileSessionChallenge({ code, installationId });
    if (!exchanged) {
      return NextResponse.json({ success: false, error: "challenge หมดอายุหรือถูกใช้งานแล้ว" }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: exchanged });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "แลก mobile session ไม่สำเร็จ" },
      { status: 503 }
    );
  }
}
