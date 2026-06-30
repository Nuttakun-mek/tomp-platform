import { DriverCard } from "@/components/driver/driver-card";
import { PageHeader } from "@/components/page-header";
import { getDriverAssignmentByToken } from "@/lib/data/driver-access";

interface DriverPageProps {
  searchParams?: Promise<{ token?: string }>;
}

export default async function DriverPage({ searchParams }: DriverPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = params.token || "";
  const driverAccess = token ? await getDriverAssignmentByToken(token) : null;

  return (
    <>
      <PageHeader
        eyebrow="หน้าคนขับ"
        title="เข้าถึงงานด้วย QR"
        description={driverAccess ? "ตรวจสอบสิทธิ์เข้าถึง Assignment นี้แล้ว" : "คนขับต้องเปิดลิงก์จาก QR ที่ศูนย์ควบคุมสร้างให้"}
      />
      {!driverAccess ? (
        <section className="rounded-md border border-red-200 bg-red-50 p-5 text-sm font-medium leading-6 text-red-900">
          ไม่พบ Assignment ที่ผูกกับ token นี้ หรือ QR หมดอายุแล้ว กรุณาติดต่อศูนย์ควบคุมเพื่อขอ QR ใหม่
        </section>
      ) : (
        <DriverCard driverAccess={driverAccess} />
      )}
    </>
  );
}
