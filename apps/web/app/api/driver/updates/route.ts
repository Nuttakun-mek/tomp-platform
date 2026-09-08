import { NextResponse } from "next/server";
import { getDriverAssignmentByToken } from "@/lib/data/driver-access";

// Lightweight poll target for the driver task view — messages from the control
// centre, route changes, and the current assignment status. No realtime channel;
// the driver page hits this every ~15s.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ success: false, error: "ต้องระบุ token" }, { status: 400 });

  const driverAccess = await getDriverAssignmentByToken(token);
  if (!driverAccess) return NextResponse.json({ success: false, error: "QR หมดอายุหรือถูกยกเลิก" }, { status: 404 });

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    data: {
      assignmentStatus: driverAccess.assignment.status,
      notifications: driverAccess.notifications,
      routeChanges: driverAccess.routeChanges
    }
  });
}
