import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/async/timeout";
import { getDriverCommsByProjectId } from "@/lib/data/driver-comms";
import { getLatestAssignmentStatuses } from "@/lib/data/assignment-status";

// Poll target for the control-centre comms console + fleet board: driver <-> centre
// messages and the latest driver-reported status per assignment.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ success: false, error: "ต้องระบุ projectId" }, { status: 400 });
  }

  try {
    const [comms, statuses] = await withTimeout(
      Promise.all([getDriverCommsByProjectId(projectId), getLatestAssignmentStatuses(projectId)]),
      9000,
      "mission control comms"
    );
    return NextResponse.json({ success: true, checkedAt: new Date().toISOString(), data: { ...comms, statuses } });
  } catch (error) {
    return NextResponse.json({
      success: false,
      checkedAt: new Date().toISOString(),
      data: { inbound: [], outbound: [], statuses: {} },
      error: error instanceof Error ? error.message : "โหลดข้อมูลการสื่อสารไม่สำเร็จ"
    });
  }
}
