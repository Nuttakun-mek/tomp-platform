import "server-only";

import { getDriverAssignmentByToken } from "@/lib/data/driver-access";

export interface DriverTokenContext {
  token: string;
  projectId: string;
  assignmentId: string;
  driverId: string;
}

// Resolves + verifies the driver access token for a write API route (mobile app).
// The token is authoritative: callers cannot spoof projectId / assignmentId /
// driverId in the request body.
export async function resolveDriverTokenContext(
  request: Request,
  body: unknown
): Promise<{ ok: true; context: DriverTokenContext } | { ok: false; status: number; error: string }> {
  const fromHeader = request.headers.get("x-driver-token")?.trim();
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token")?.trim();
  const fromBody =
    body && typeof body === "object" && typeof (body as { token?: unknown }).token === "string"
      ? ((body as { token: string }).token.trim())
      : "";
  const token = fromHeader || fromQuery || fromBody;

  if (!token) return { ok: false, status: 401, error: "ต้องระบุ token ของงาน" };

  const access = await getDriverAssignmentByToken(token);
  if (!access) return { ok: false, status: 403, error: "QR หมดอายุหรือถูกยกเลิก" };

  return {
    ok: true,
    context: {
      token,
      projectId: access.project.id,
      assignmentId: access.assignment.id,
      driverId: access.driver.id
    }
  };
}
