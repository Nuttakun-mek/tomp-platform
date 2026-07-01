import { getRouteChangeThaiMessage } from "@tomp/driver-core";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverRouteChangeAlert({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const instruction =
    driverAccess.routeChanges[0] ?? {
      id: driverAccess.assignment.id,
      assignmentId: driverAccess.assignment.id,
      reason: "ศูนย์ควบคุมอาจแจ้งเปลี่ยนจุดรับ จุดส่ง หรือเส้นทางระหว่างปฏิบัติงาน",
      impactSummary: "หากมีการเปลี่ยนแปลง ให้กดรับทราบก่อนเดินทางต่อ",
      newRoute: { summary: "เส้นทางปัจจุบัน", stops: [], metadata: {} },
      status: "pending" as const
    };

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
      <p className="text-sm font-semibold text-amber-900">แจ้งเปลี่ยนเส้นทาง</p>
      <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900">
        {driverAccess.routeChanges.length ? "คำสั่งจากศูนย์ควบคุม" : "พื้นที่เตรียมพร้อม"}
      </span>
      <p className="mt-2 text-sm leading-6 text-amber-950">{getRouteChangeThaiMessage(instruction)}</p>
      <p className="mt-1 text-sm leading-6 text-amber-900">{instruction.impactSummary}</p>
      <button className="mt-4 min-h-12 w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-950" type="button">
        กดรับทราบ
      </button>
    </section>
  );
}
