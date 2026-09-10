import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CarFront, UserRoundCheck } from "lucide-react";
import { ProjectWorkspaceTabs } from "@/components/projects/project-workspace-tabs";
import { ResourceOverview } from "@/components/resources/resource-overview";
import { ResourceQualityCard } from "@/components/resources/resource-quality-card";
import { VendorResourceSummary } from "@/components/resources/vendor-resource-summary";
import { CreateDriverForm } from "@/components/resources/create-driver-form";
import { CreateVehicleForm } from "@/components/resources/create-vehicle-form";
import { ProjectResourceManager } from "@/components/resources/project-resource-manager";
import {
  getDrivers,
  getLibraryDrivers,
  getLibraryVehicles,
  getProjectDrivers,
  getProjectVehicles,
  getVehicles
} from "@/lib/data/resources";

interface ResourcesPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const params = searchParams ? await searchParams : {};
  const projectId = params.projectId || "";

  // Inside a project the lists are that project's own; outside one this is the
  // central library, which is where records are kept between events.
  const [drivers, vehicles, libraryDrivers, libraryVehicles] = projectId
    ? await Promise.all([
        getProjectDrivers(projectId),
        getProjectVehicles(projectId),
        getLibraryDrivers(projectId),
        getLibraryVehicles(projectId)
      ])
    : await Promise.all([getDrivers(), getVehicles(), Promise.resolve([]), Promise.resolve([])]);
  const missingDrivers = drivers.filter((driver) => !driver.phone).length;
  const missingVehicles = vehicles.filter((vehicle) => !vehicle.plateNumber).length;

  return (
    <div className="grid gap-4">
      {projectId ? <ProjectWorkspaceTabs projectId={projectId} active="resources" /> : null}
      <ResourceOverview drivers={drivers} vehicles={vehicles} />
      <div className="grid gap-4 md:grid-cols-3">
        <ResourceQualityCard title="พร้อมใช้งาน" value={`${drivers.length - missingDrivers + vehicles.length - missingVehicles}`} detail="คนขับและรถที่มีข้อมูลหลักครบ" />
        <ResourceQualityCard title="ขาดข้อมูล" value={`${missingDrivers + missingVehicles}`} detail="รายการที่ควรเติมก่อนมอบงาน" />
        <ResourceQualityCard title="ต้องตรวจสอบ" value="0" detail="ยังไม่พบรายการเสี่ยงในรอบทดสอบภายใน" />
      </div>
      {projectId ? (
        <>
          <ProjectResourceManager
            projectId={projectId}
            drivers={drivers}
            vehicles={vehicles}
            libraryDrivers={libraryDrivers}
            libraryVehicles={libraryVehicles}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <CreateDriverForm projectId={projectId} />
            <CreateVehicleForm projectId={projectId} />
          </div>
        </>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ResourceLink href={withProject("/resources/drivers", projectId)} title="คนขับ" detail="จัดการรายชื่อ เบอร์โทร สถานะ และความพร้อมสำหรับรับงาน" icon={<UserRoundCheck className="h-6 w-6" />} />
        <ResourceLink href={withProject("/resources/vehicles", projectId)} title="จัดการรถ" detail="ดูโปรไฟล์รถ คิวงาน งานปัจจุบัน งานคงเหลือ QR ประจำรถ และแผนที่รวม" icon={<CarFront className="h-6 w-6" />} />
      </div>
      <VendorResourceSummary />
    </div>
  );
}

function withProject(href: string, projectId?: string) {
  return projectId ? `${href}?projectId=${encodeURIComponent(projectId)}` : href;
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
