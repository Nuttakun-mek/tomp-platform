import type { DriverNotification } from "@tomp/types/domain";

function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented. Use apps/web server actions until the shared API is wired.`);
}

export async function fetchDriverNotifications(_assignmentId: string): Promise<DriverNotification[]> {
  return notImplemented("fetchDriverNotifications");
}

export async function acknowledgeDriverNotification(_notificationId: string): Promise<void> {
  return notImplemented("acknowledgeDriverNotification");
}

export async function markDriverNotificationActioned(_notificationId: string): Promise<void> {
  return notImplemented("markDriverNotificationActioned");
}
