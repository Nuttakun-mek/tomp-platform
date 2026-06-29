import { DriverCard } from "@/components/driver/driver-card";
import { PageHeader } from "@/components/page-header";
import { getDriverAssignmentByToken } from "@/lib/data/driver-access";

interface DriverTokenPageProps {
  params: Promise<{ token: string }>;
}

export default async function DriverTokenPage({ params }: DriverTokenPageProps) {
  const { token } = await params;
  const driverAccess = await getDriverAssignmentByToken(token);

  return (
    <>
      <PageHeader
        eyebrow="หน้าคนขับ"
        title="เข้าถึงงาน Assignment"
        description={driverAccess.tokenValidated ? "ตรวจสอบสิทธิ์เข้าถึงเฉพาะ Assignment นี้แล้ว" : "กำลังใช้ข้อมูลตัวอย่างหรือ token ไม่ถูกต้อง ต้องสร้าง QR จากหน้าจัดสรรงานก่อนใช้งานจริง"}
      />
      {!driverAccess.tokenValidated && token.startsWith("tomp_") ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-900">
          ลิงก์เข้าถึงงานนี้ไม่ถูกต้อง หมดอายุ หรือถูกยกเลิกแล้ว กรุณาติดต่อศูนย์ควบคุมเพื่อขอ QR ใหม่
        </section>
      ) : (
        <>
          {!driverAccess.tokenValidated ? (
            <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              กำลังใช้โหมดข้อมูลตัวอย่าง ก่อนทดสอบ Pilot ควรสร้าง QR ที่ผูกกับ Assignment จริง
            </div>
          ) : null}
          <DriverCard driverAccess={driverAccess} />
        </>
      )}
    </>
  );
}
