import { NextResponse } from "next/server";
import { driverCheckinAction } from "@/app/actions/driver";
import { trustedDriverScope } from "@/lib/driver/trusted-scope";
import { resolveDriverSession } from "@/lib/api/driver-token";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const result = await driverCheckinAction({
    ...(body && typeof body === "object" ? body : {}),
    projectId: auth.context.projectId,
    assignmentId: auth.context.assignmentId,
    driverId: auth.context.driverId
  }, trustedDriverScope(auth.context));
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
