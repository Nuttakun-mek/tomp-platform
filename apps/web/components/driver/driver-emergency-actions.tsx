import { DriverContactStrip } from "./driver-contact-strip";

export function DriverEmergencyActions() {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-soft">
      <p className="text-sm font-semibold text-rose-900">ติดต่อผู้ประสานงาน / ศูนย์ควบคุม</p>
      <p className="mt-1 text-sm text-rose-800">ใช้เมื่อมีปัญหา หน้างานไม่ชัดเจน หรือจำเป็นต้องประสานศูนย์ควบคุม</p>
      <div className="mt-4">
        <DriverContactStrip />
      </div>
    </section>
  );
}
