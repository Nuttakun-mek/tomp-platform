import type { DriverAssignmentInstruction, RouteChangeInstruction } from "@tomp/types/domain";

function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented. Use apps/web server actions until the shared API is wired.`);
}

export async function fetchAssignmentInstructions(_assignmentId: string): Promise<DriverAssignmentInstruction[]> {
  return notImplemented("fetchAssignmentInstructions");
}

export async function fetchRouteChangeInstructions(_assignmentId: string): Promise<RouteChangeInstruction[]> {
  return notImplemented("fetchRouteChangeInstructions");
}

export async function acknowledgeRouteChange(_routeChangeId: string): Promise<void> {
  return notImplemented("acknowledgeRouteChange");
}
