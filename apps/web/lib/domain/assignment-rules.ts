export interface TimeRangeInput {
  startTime?: string | null;
  endTime?: string | null;
}

export interface AssignmentWindow extends TimeRangeInput {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
}

export function checkAssignmentTimeRange({ startTime, endTime }: TimeRangeInput): boolean {
  if (!startTime || !endTime) {
    return true;
  }

  return new Date(endTime).getTime() >= new Date(startTime).getTime();
}

export function hasAssignmentTimeConflict(candidate: AssignmentWindow, existing: AssignmentWindow[]): boolean {
  if (!candidate.startTime || !candidate.endTime) return false;
  const start = new Date(candidate.startTime).getTime();
  const end = new Date(candidate.endTime).getTime();

  return existing.some((assignment) => {
    if (assignment.id === candidate.id || !assignment.startTime || !assignment.endTime) return false;
    const sameDriver = candidate.driverId && assignment.driverId === candidate.driverId;
    const sameVehicle = candidate.vehicleId && assignment.vehicleId === candidate.vehicleId;
    if (!sameDriver && !sameVehicle) return false;

    const otherStart = new Date(assignment.startTime).getTime();
    const otherEnd = new Date(assignment.endTime).getTime();
    return start < otherEnd && otherStart < end;
  });
}

export function getMissingAssignmentData(input: { callSignId?: string | null; driverId?: string | null; vehicleId?: string | null; startTime?: string | null; endTime?: string | null }): string[] {
  const missing: string[] = [];
  if (!input.callSignId) missing.push("call sign");
  if (!input.driverId) missing.push("driver");
  if (!input.vehicleId) missing.push("vehicle");
  if (!input.startTime || !input.endTime) missing.push("time window");
  return missing;
}

export function getAssignmentReadinessStatus(missingItems: string[]): "ready" | "warning" | "blocked" {
  if (missingItems.length === 0) return "ready";
  if (missingItems.includes("call sign") || missingItems.includes("time window")) return "blocked";
  return "warning";
}

export function buildGoogleMapsDirectionsUrl(destination: string, origin?: string): string {
  const params = new URLSearchParams({
    api: "1",
    destination
  });

  if (origin) {
    params.set("origin", origin);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
