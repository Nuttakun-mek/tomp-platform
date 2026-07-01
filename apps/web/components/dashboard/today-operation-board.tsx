import Link from "next/link";
import type { DriverLocation, Project, TimelineEvent } from "@tomp/types/domain";
import { TimelineItem } from "@/components/ui/timeline-item";

export function TodayOperationBoard({ projects, latestLocation, latestEvent }: { projects: Project[]; latestLocation?: DriverLocation; latestEvent?: TimelineEvent }) {
  return (
    <section className="enterprise-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-operation">TODAY OPERATIONS</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">กระดานปฏิบัติการวันนี้</h2>
        </div>
        <Link className="rounded-2xl border border-operation/30 bg-teal-50 px-4 py-2 text-sm font-semibold text-operation transition hover:bg-teal-100" href="/projects">
          ดูโครงการ
        </Link>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-500">โครงการที่กำลังติดตาม</p>
          <div className="mt-3 grid gap-2">
            {projects.slice(0, 4).map((project) => (
              <Link key={project.id} className="rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-ink shadow-sm transition hover:text-operation" href={`/projects/${project.id}`}>
                {project.projectCode} · {project.projectName}
              </Link>
            ))}
            {projects.length === 0 ? <p className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">ยังไม่มีโครงการที่ต้องติดตาม</p> : null}
          </div>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-500">GPS ล่าสุด</p>
          {latestLocation ? (
            <div className="mt-3">
              <p className="text-lg font-semibold text-ink">{String(latestLocation.metadata.callSign || "ยังไม่ระบุ Call Sign")}</p>
              <p className="text-sm text-slate-600">{String(latestLocation.metadata.driverName || "ยังไม่ระบุคนขับ")}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(latestLocation.recordedAt).toLocaleString("th-TH")}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">ยังไม่มี GPS ล่าสุด</p>
          )}
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-500">ลำดับเหตุการณ์ล่าสุด</p>
          {latestEvent ? <TimelineItem title={latestEvent.eventType} detail={latestEvent.reason || "บันทึกลำดับเหตุการณ์"} time={new Date(latestEvent.createdAt).toLocaleString("th-TH")} /> : <p className="mt-3 text-sm text-slate-600">ยังไม่มีลำดับเหตุการณ์</p>}
        </div>
      </div>
    </section>
  );
}
