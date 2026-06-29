import { ExceptionList } from "@/components/mission-control/exception-list";
import { FleetBoard } from "@/components/mission-control/fleet-board";
import { LiveLocationMap } from "@/components/mission-control/live-location-map";
import { ReadinessBoard } from "@/components/mission-control/readiness-board";
import { RealtimeStatusPanel } from "@/components/mission-control/realtime-status-panel";
import { TimelineFeed } from "@/components/mission-control/timeline-feed";
import { PageHeader } from "@/components/page-header";
import { getProjects } from "@/lib/data/projects";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";
import { getLatestDriverLocationsByProjectId } from "@/lib/data/locations";
import { demoProject } from "@/lib/demo/demo-kernel";

export default async function MissionControlPage() {
  const projects = await getProjects();
  const activeProject = projects[0] ?? demoProject;
  const events = await getTimelineEventsByProjectId(activeProject.id);
  const locations = await getLatestDriverLocationsByProjectId(activeProject.id);

  return (
    <>
      <PageHeader
        eyebrow="ศูนย์ควบคุมปฏิบัติการ"
        title="Mission Control สำหรับทีมปฏิบัติการ"
        description="หน้ารวมความพร้อม รถ คนขับ รายการที่ต้องติดตาม ลำดับเหตุการณ์ และสถานะการเชื่อมต่อสำหรับ Pilot ภายใน"
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs font-semibold text-teal-800">ความพร้อมรวม</p>
          <p className="mt-2 text-2xl font-semibold text-teal-950">72%</p>
          <p className="mt-1 text-sm text-teal-800">ข้อมูลตัวอย่าง</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">ต้องติดตาม</p>
          <p className="mt-2 text-2xl font-semibold text-amber-950">4 รายการ</p>
          <p className="mt-1 text-sm text-amber-800">ก่อนประกาศใช้แผน</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Assignment</p>
          <p className="mt-2 text-2xl font-semibold text-ink">1 งาน</p>
          <p className="mt-1 text-sm text-slate-600">พร้อมสำหรับทดสอบ</p>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-800">Timeline</p>
          <p className="mt-2 text-2xl font-semibold text-blue-950">{events.length}</p>
          <p className="mt-1 text-sm text-blue-800">เหตุการณ์ล่าสุด</p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <ReadinessBoard />
          <FleetBoard />
          <ExceptionList />
        </div>
        <div className="grid gap-6">
          <TimelineFeed events={events} />
          <RealtimeStatusPanel projectId={activeProject.id} />
        </div>
      </div>

      <div className="mt-6">
        <LiveLocationMap projectId={activeProject.id} initialLocations={locations} />
      </div>
    </>
  );
}
