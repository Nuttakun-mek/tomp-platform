import { describe, expect, it } from "vitest";
import { buildDriverNotification, getDriverNotificationActionLabel, shouldEscalateDriverNotification } from "../notification";

describe("driver notifications", () => {
  it("builds unread notification by default", () => {
    const notification = buildDriverNotification({
      id: "n",
      projectId: "p",
      notificationType: "route_change",
      priority: "critical",
      title: "เปลี่ยนเส้นทาง",
      body: "กรุณารับทราบ",
      action: "acknowledge",
      metadata: {}
    });
    expect(notification.status).toBe("unread");
    expect(shouldEscalateDriverNotification(notification)).toBe(true);
  });

  it("maps action label", () => {
    expect(getDriverNotificationActionLabel("call_control")).toBe("โทรศูนย์ควบคุม");
  });
});
