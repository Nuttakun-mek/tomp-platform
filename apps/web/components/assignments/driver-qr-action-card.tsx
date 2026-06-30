import type { Assignment } from "@tomp/types/domain";
import { DriverAccessGenerator } from "@/components/driver/driver-access-generator";

export function DriverQrActionCard({ assignment, projectId }: { assignment?: Assignment; projectId: string }) {
  return (
    <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-semibold text-blue-900">ลิงก์ QR สำหรับคนขับ</p>
      <p className="mt-1 text-sm text-blue-800">สร้างลิงก์แบบผูกกับ Assignment เพื่อให้คนขับเข้าหน้างานและแชร์ GPS</p>
      {assignment ? <div className="mt-3"><DriverAccessGenerator assignments={[assignment]} projectId={projectId} /></div> : null}
    </section>
  );
}
