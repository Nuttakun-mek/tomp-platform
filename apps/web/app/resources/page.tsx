import Link from "next/link";
import { ResourceOverview } from "@/components/resources/resource-overview";
import { ResourceQualityCard } from "@/components/resources/resource-quality-card";
import { VendorResourceSummary } from "@/components/resources/vendor-resource-summary";
import { getDrivers, getVehicles } from "@/lib/data/resources";

export default async function ResourcesPage() {
  const [drivers, vehicles] = await Promise.all([getDrivers(), getVehicles()]);
  const missingDrivers = drivers.filter((driver) => !driver.phone).length;
  const missingVehicles = vehicles.filter((vehicle) => !vehicle.plateNumber).length;

  return (
    <>
      <ResourceOverview drivers={drivers} vehicles={vehicles} />
      <div className="grid gap-4 md:grid-cols-3">
        <ResourceQualityCard title="พร้อมใช้งาน" value={`${drivers.length - missingDrivers + vehicles.length - missingVehicles}`} detail="คนขับและรถที่มีข้อมูลหลักครบ" />
        <ResourceQualityCard title="ขาดข้อมูล" value={`${missingDrivers + missingVehicles}`} detail="รายการที่ควรเติมก่อนจัดสรรงาน" />
        <ResourceQualityCard title="ต้องตรวจสอบ" value="0" detail="ยังไม่พบรายการเสี่ยงใน Pilot" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="rounded-md border border-slate-200 bg-white p-5 shadow-soft hover:border-operation" href="/resources/drivers">
          <h2 className="text-lg font-semibold text-ink">คนขับ</h2>
          <p className="mt-2 text-sm text-slate-600">ตรวจเบอร์โทร สถานะ และความพร้อมสำหรับ Assignment</p>
        </Link>
        <Link className="rounded-md border border-slate-200 bg-white p-5 shadow-soft hover:border-operation" href="/resources/vehicles">
          <h2 className="text-lg font-semibold text-ink">รถ</h2>
          <p className="mt-2 text-sm text-slate-600">ตรวจทะเบียน ประเภท ความจุ และสถานะพร้อมใช้</p>
        </Link>
      </div>
      <VendorResourceSummary />
    </>
  );
}
