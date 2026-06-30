import { ExceptionList } from "@/components/mission-control/exception-list";
import { FleetBoard } from "@/components/mission-control/fleet-board";
import { LiveLocationMap } from "@/components/mission-control/live-location-map";
import { ReadinessBoard } from "@/components/mission-control/readiness-board";
import { RealtimeStatusPanel } from "@/components/mission-control/realtime-status-panel";
import { TimelineFeed } from "@/components/mission-control/timeline-feed";
import { PageHeader } from "@/components/page-header";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestDriverLocationsByProjectId, getProjectIdWithLatestDriverLocation } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";
import { demoProject } from "@/lib/demo/demo-kernel";

interface MissionControlPageProps {
  searchParams?: Promise<{ projectId?: string }>;
}

export default async function MissionControlPage({ searchParams }: MissionControlPageProps) {
  const params = searchParams ? await searchParams : {};
  const projects = await getProjects();
  const latestLocationProjectId = params.projectId ? null : await getProjectIdWithLatestDriverLocation();
  const activeProject =
    projects.find((project) => project.id === params.projectId) ??
    projects.find((project) => project.id === latestLocationProjectId) ??
    projects[0] ??
    demoProject;

  const [events, locations, assignments] = await Promise.all([
    getTimelineEventsByProjectId(activeProject.id),
    getLatestDriverLocationsByProjectId(activeProject.id),
    getAssignmentsByProjectId(activeProject.id)
  ]);

  const readinessPercent = assignments.length ? Math.min(100, Math.round((locations.length / assignments.length) * 100)) : 0;
  const followUpCount = assignments.filter((assignment) => !assignment.driverId || !assignment.vehicleId || !assignment.callSignId).length;
  const autoSelectedFromLiveLocation = latestLocationProjectId === activeProject.id && !params.projectId;

  return (
    <>
      <PageHeader
        eyebrow="ศูนย์ควบคุมปฏิบัติการ"
        title="Mission Control สำหรับทีมปฏิบัติการ"
        description={`ดู Assignment, Timeline และตำแหน่งคนขับของโครงการ ${activeProject.projectCode}`}
      />

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">โครงการที่กำลังติดตาม</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{activeProject.projectName}</h2>
            <p className="text-sm text-slate-600">
              {activeProject.projectCode}
              {autoSelectedFromLiveLocation ? " | เลือกอัตโนมัติจากตำแหน่ง GPS ล่าสุด" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {projects.slice(0, 6).map((project) => (
              <a
                key={project.id}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  project.id === activeProject.id
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                }`}
                href={`/mission-control?projectId=${project.id}`}
              >
                {project.projectCode}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs font-semibold text-teal-800">ความพร้อมจากตำแหน่งล่าสุด</p>
          <p className="mt-2 text-2xl font-semibold text-teal-950">{readinessPercent}%</p>
          <p className="mt-1 text-sm text-teal-800">คำนวณจาก Assignment ที่มีตำแหน่ง GPS ล่าสุด</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">ต้องติดตาม</p>
          <p className="mt-2 text-2xl font-semibold text-amber-950">{followUpCount} รายการ</p>
          <p className="mt-1 text-sm text-amber-800">Assignment ที่ยังขาดข้อมูลหลัก</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Assignment</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{assignments.length} งาน</p>
          <p className="mt-1 text-sm text-slate-600">จากโครงการที่เลือก</p>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-800">Timeline</p>
          <p className="mt-2 text-2xl font-semibold text-blue-950">{events.length}</p>
          <p className="mt-1 text-sm text-blue-800">เหตุการณ์ล่าสุด</p>
        </div>
      </section>

      <div className="mt-6">
        <LiveLocationMap projectId={activeProject.id} initialLocations={locations} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <ReadinessBoard assignmentCount={assignments.length} liveLocationCount={locations.length} />
          <FleetBoard assignments={assignments} locations={locations} />
          <ExceptionList assignments={assignments} />
        </div>
        <div className="grid gap-6">
          <TimelineFeed events={events} />
          <RealtimeStatusPanel projectId={activeProject.id} />
        </div>
      </div>
    </>
  );
}
