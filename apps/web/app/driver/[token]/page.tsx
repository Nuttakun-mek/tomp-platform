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
        description={driverAccess ? "ตรวจสอบสิทธิ์เข้าถึง Assignment นี้แล้ว" : "ไม่พบ Assignment ที่ผูกกับ token นี้ หรือ QR หมดอายุแล้ว"}
      />
      {!driverAccess ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-5 text-sm font-medium leading-6 text-red-900">
          ลิงก์เข้าถึงงานนี้ไม่ถูกต้อง หมดอายุ หรือถูกยกเลิกแล้ว กรุณาติดต่อศูนย์ควบคุมเพื่อขอ QR ใหม่
        </section>
      ) : (
        <DriverCard driverAccess={driverAccess} />
      )}
    </>
  );
}
