import { NextResponse } from "next/server";
import { resolveDriverSession } from "@/lib/api/driver-token";
import { createMobileSessionChallenge } from "@/lib/driver-access/mobile-session";

export async function POST(request: Request) {
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const challenge = await createMobileSessionChallenge(auth.context);
    return NextResponse.json({ success: true, data: challenge });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "สร้าง mobile session challenge ไม่สำเร็จ" },
      { status: 503 }
    );
  }
}
