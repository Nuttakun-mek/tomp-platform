import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { resolveDriverSession } from "@/lib/api/driver-token";
import { getDriverUpdatesFor } from "@/lib/data/driver-access";

// Lightweight poll target for the driver task view — messages from the control
// centre, route changes, and the current assignment status. Authenticated by the
// scoped driver session cookie (no raw token). Most polls change nothing, so we
// send a weak ETag and answer 304 when the phone already has the current picture.
export async function GET(request: Request) {
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const updates = await getDriverUpdatesFor({
    projectId: auth.context.projectId,
    assignmentId: auth.context.assignmentId,
    driverId: auth.context.driverId
  });
  if (!updates) return NextResponse.json({ success: false, error: "ไม่พบข้อมูลงาน" }, { status: 404 });

  const body = { success: true as const, checkedAt: new Date().toISOString(), data: updates };

  const etag = `"${createHash("sha1").update(JSON.stringify(updates)).digest("base64url")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return NextResponse.json(body, { headers: { ETag: etag, "Cache-Control": "no-store" } });
}
