import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CarFront, UserRoundCheck } from "lucide-react";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { ResourceOverview } from "@/components/resources/resource-overview";
import { ResourceQualityCard } from "@/components/resources/resource-quality-card";
import { VendorResourceSummary } from "@/components/resources/vendor-resource-summary";
import { getDrivers, getVehicles } from "@/lib/data/resources";

interface ResourcesPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const params = searchParams ? await searchParams : {};
  const [drivers, vehicles] = await Promise.all([getDrivers(), getVehicles()]);
  const missingDrivers = drivers.filter((driver) => !driver.phone).length;
  const missingVehicles = vehicles.filter((vehicle) => !vehicle.plateNumber).length;

  return (
    <div className="grid gap-4">
      {params.projectId ? <ProjectWorkspaceTabs projectId={params.projectId} active="resources" /> : null}
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
    </div>
  );
}

function ResourceLink({ href, title, detail, icon }: { href: string; title: string; detail: string; icon: ReactNode }) {
  return (
    <Link className="smart-card group p-4" href={href}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-panel bg-command text-white">{icon}</span>
        <ArrowRight className="h-5 w-5 text-ink-faint transition group-hover:translate-x-1 group-hover:text-operation" />
      </div>
      <h2 className="card-title mt-4">{title}</h2>
      <p className="section-description mt-1.5">{detail}</p>
    </Link>
  );
}
