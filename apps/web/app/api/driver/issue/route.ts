import { NextResponse } from "next/server";
import { driverIssueReportAction } from "@/app/actions/driver";
import { resolveDriverSession } from "@/lib/api/driver-token";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const result = await driverIssueReportAction({
    ...(body && typeof body === "object" ? body : {}),
    projectId: auth.context.projectId,
    assignmentId: auth.context.assignmentId,
    driverId: auth.context.driverId
  });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
