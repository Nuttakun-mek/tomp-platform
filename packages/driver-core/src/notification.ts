import type { DriverNotification, DriverNotificationAction, DriverNotificationPriority } from "@tomp/types/domain";

export function buildDriverNotification(input: Omit<DriverNotification, "createdAt" | "status"> & { createdAt?: string; status?: DriverNotification["status"] }): DriverNotification {
  return {
    ...input,
    status: input.status ?? "unread",
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}

export function getDriverNotificationPriority(notification: Pick<DriverNotification, "priority">): DriverNotificationPriority {
  return notification.priority;
}

export function getDriverNotificationActionLabel(action: DriverNotificationAction) {
  const labels: Record<DriverNotificationAction, string> = {
    acknowledge: "รับทราบ",
    call_control: "โทรศูนย์ควบคุม",
    open_maps: "เปิด Google Maps",
    report_issue: "แจ้งปัญหา",
    none: "ไม่มี action"
  };
  return labels[action];
}

export function shouldEscalateDriverNotification(notification: DriverNotification) {
  return notification.priority === "critical" && notification.status !== "actioned";
}
