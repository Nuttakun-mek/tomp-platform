import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { DriverReadinessTable } from "@/components/resources/driver-readiness-table";
import { ResourceQualityCard } from "@/components/resources/resource-quality-card";
import { getDrivers } from "@/lib/data/resources";

export default async function DriversPage() {
  const drivers = await getDrivers();
  const missingPhone = drivers.filter((driver) => !driver.phone).length;

  return (
    <>
      <section className="enterprise-panel p-5">
        <p className="page-kicker">Drivers</p>
        <h1 className="mt-1 page-title">คนขับ</h1>
        <p className="mt-2 page-description">เตรียมข้อมูลคนขับสำหรับ QR การติดต่อ และการแชร์ GPS ระหว่างปฏิบัติงาน</p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <ResourceQualityCard title="คนขับทั้งหมด" value={`${drivers.length}`} detail="จากฐานข้อมูลปัจจุบัน" />
        <ResourceQualityCard title="พร้อมใช้งาน" value={`${drivers.length - missingPhone}`} detail="มีเบอร์โทรและสถานะใช้งานได้" />
        <ResourceQualityCard title="ขาดข้อมูล" value={`${missingPhone}`} detail="ควรเติมเบอร์โทรก่อนใช้งานจริง" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <CreateDriverForm />
        <DriverReadinessTable drivers={drivers} />
      </div>
    </>
  );
}
