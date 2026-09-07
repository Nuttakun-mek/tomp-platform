import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CarFront, UserRoundCheck } from "lucide-react";
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
        <ResourceQualityCard title="ขาดข้อมูล" value={`${missingDrivers + missingVehicles}`} detail="รายการที่ควรเติมก่อนมอบงาน" />
        <ResourceQualityCard title="ต้องตรวจสอบ" value="0" detail="ยังไม่พบรายการเสี่ยงในรอบทดสอบภายใน" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ResourceLink href="/resources/drivers" title="คนขับ" detail="จัดการรายชื่อ เบอร์โทร สถานะ และความพร้อมสำหรับรับงาน" icon={<UserRoundCheck className="h-6 w-6" />} />
        <ResourceLink href="/resources/vehicles" title="จัดการรถ" detail="ดูโปรไฟล์รถ คิวงาน งานปัจจุบัน งานคงเหลือ QR ประจำรถ และแผนที่รวม" icon={<CarFront className="h-6 w-6" />} />
      </div>
      <VendorResourceSummary />
    </>
  );
}

function ResourceLink({ href, title, detail, icon }: { href: string; title: string; detail: string; icon: ReactNode }) {
  return (
    <Link className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-operation hover:shadow-panel" href={href}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">{icon}</span>
        <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-operation" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </Link>
  );
}
