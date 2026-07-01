"use server";

import { createTimelineEvent } from "@/lib/timeline";

export interface DriverNotificationActionResult {
  success: boolean;
  error?: string;
}

async function acknowledgePlaceholder(projectId: string, assignmentId: string, eventType: string): Promise<DriverNotificationActionResult> {
  // TODO: Persist acknowledgement in driver_acknowledgements and update driver_notifications.
  // This placeholder keeps the future timeline contract explicit without enabling a partial workflow.
  await createTimelineEvent({
    projectId,
    objectType: "assignment",
    objectId: assignmentId,
    eventType,
    source: "driver_qr",
    reason: "Driver notification acknowledgement placeholder",
    afterData: {},
    metadata: { implementationStatus: "placeholder" }
  }).catch(() => undefined);

  return { success: true };
}

export async function acknowledgeDriverNotificationAction(input: { projectId: string; assignmentId: string; notificationId: string }) {
  return acknowledgePlaceholder(input.projectId, input.assignmentId, "DRIVER_NOTIFICATION_ACKNOWLEDGED");
}

export async function acknowledgeRouteChangeAction(input: { projectId: string; assignmentId: string; routeChangeId: string }) {
  return acknowledgePlaceholder(input.projectId, input.assignmentId, "DRIVER_ROUTE_CHANGE_ACKNOWLEDGED");
}

export async function markDriverNotificationReadAction(input: { projectId: string; assignmentId: string; notificationId: string }) {
  return acknowledgePlaceholder(input.projectId, input.assignmentId, "DRIVER_NOTIFICATION_READ");
}
