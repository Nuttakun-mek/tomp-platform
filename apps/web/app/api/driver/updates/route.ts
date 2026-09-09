import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getDriverUpdatesByToken } from "@/lib/data/driver-access";

// Lightweight poll target for the driver task view — messages from the control
// centre, route changes, and the current assignment status. The driver page
// hits this every ~15s; most polls change nothing, so we send a weak ETag and
// answer 304 when the driver's phone already has the current picture (saves the
// payload on a field 3G/4G connection).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ success: false, error: "ต้องระบุ token" }, { status: 400 });

  const updates = await getDriverUpdatesByToken(token);
  if (!updates) return NextResponse.json({ success: false, error: "QR หมดอายุหรือถูกยกเลิก" }, { status: 404 });

  const body = {
    success: true as const,
    checkedAt: new Date().toISOString(),
    data: updates
  };

  // ETag over the payload only (not checkedAt) so an unchanged picture keeps the
  // same tag across polls.
  const etag = `"${createHash("sha1").update(JSON.stringify(updates)).digest("base64url")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return NextResponse.json(body, { headers: { ETag: etag, "Cache-Control": "no-store" } });
}
