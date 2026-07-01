import { buildDriverNotification, getDriverNotificationActionLabel } from "@tomp/driver-core";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverNotificationPanel({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const notification = buildDriverNotification({
    id: driverAccess.assignment.id,
    projectId: driverAccess.project.id,
    assignmentId: driverAccess.assignment.id,
    driverId: driverAccess.driver.id,
    notificationType: "assignment_ready",
    priority: "normal",
    title: "งานใหม่",
    body: "กรุณาตรวจสอบรายละเอียดงานและกดรับทราบก่อนเริ่มปฏิบัติงาน",
    action: "acknowledge",
    metadata: { source: "web_driver_demo" }
  });

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-900">แจ้งเตือนจากศูนย์ควบคุม</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{notification.title}</h2>
          <p className="mt-1 text-sm leading-6 text-blue-900">{notification.body}</p>
        </div>
        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">ข้อมูลตัวอย่าง</span>
      </div>
      <button className="mt-4 min-h-12 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white" type="button">
        {getDriverNotificationActionLabel(notification.action)}
      </button>
    </section>
  );
}
