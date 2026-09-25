import type { AssignmentStatusUpdateInput, DriverCheckinInput, DriverIssueReportInput, DriverLocationUpdateInput } from "@tomp/types/schemas";

type OfflineAction =
  | { kind: "readiness"; payload: DriverCheckinInput }
  | { kind: "status"; payload: AssignmentStatusUpdateInput }
  | { kind: "issue"; payload: DriverIssueReportInput }
  | { kind: "location"; payload: DriverLocationUpdateInput };

const previewQueue: OfflineAction[] = [];

export interface FlushOfflineQueueResult {
  dropped: number;
  sent: number;
  remaining: number;
}

export async function getOfflineQueueCount() {
  return previewQueue.length;
}

export async function clearOfflineQueue() {
  previewQueue.length = 0;
}

export async function enqueueOfflineAction(kind: OfflineAction["kind"], payload: OfflineAction["payload"]) {
  previewQueue.push({ kind, payload } as OfflineAction);
}

export function flushOfflineQueue(): Promise<FlushOfflineQueueResult> {
  const remaining = previewQueue.length;
  return Promise.resolve({
    dropped: 0,
    sent: 0,
    remaining
  });
}
