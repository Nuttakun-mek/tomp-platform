import Link from "next/link";
import { ArrowRight, CarFront, MapPinned, MessageCircle } from "lucide-react";
import type { VehicleOperationProfile } from "@/lib/data/vehicle-operations";
import { gpsFreshness, gpsFreshnessLabelTh, gpsFreshnessTone } from "@/lib/domain/gps-freshness";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { VehicleMessageForm } from "./vehicle-message-form";

function gpsTone(profile: VehicleOperationProfile): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (!profile.latestLocation) return { label: "ยังไม่มี GPS", tone: "neutral" };
  const freshness = gpsFreshness(profile.latestLocation.recordedAt, profile.latestLocation.sharingEvent, Date.now());
  return { label: gpsFreshnessLabelTh(freshness), tone: gpsFreshnessTone(freshness) };
}

export function VehicleMonitorPanel({ profiles }: { profiles: VehicleOperationProfile[] }) {
  const activeCount = profiles.filter((profile) => profile.currentTasks.length > 0).length;
  const pendingCount = profiles.reduce((sum, profile) => sum + profile.remainingTasks.length, 0);

  return (
    <section className="enterprise-panel grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-kicker">ติดตามรถ</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">รถในโครงการที่กำลังติดตาม</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">ดูสถานะรถ งานปัจจุบัน งานคงเหลือ และ GPS ล่าสุด แล้วกดเข้าไปดูรายละเอียดรถแต่ละคันได้</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <SmallMetric label="รถ" value={profiles.length} />
          <SmallMetric label="ใช้งาน" value={activeCount} />
          <SmallMetric label="คงเหลือ" value={pendingCount} />
        </div>
      </div>

      <div className="grid gap-3">
        {profiles.map((profile) => {
          const gps = gpsTone(profile);
          const currentTask = profile.currentTasks[0] || profile.remainingTasks[0];
          const unreadCount = [...profile.currentTasks, ...profile.remainingTasks].reduce((sum, task) => sum + task.unreadNotifications, 0);
          return (
            <article key={profile.vehicle.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                    <CarFront className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-ink">{profile.vehicle.plateNumber || "ยังไม่ระบุทะเบียน"}</h3>
                    <p className="text-sm text-slate-600">{profile.vehicle.vehicleType || "ยังไม่ระบุประเภทรถ"} / {profile.vehicle.capacity || 0} ที่นั่ง</p>
                    <p className="mt-1 text-xs text-slate-500">งานปัจจุบัน: {currentTask?.mission?.missionName || "ยังไม่มีงาน"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={formatStatusTh(profile.vehicle.status)} tone={profile.vehicle.status === "available" ? "success" : "info"} />
                  {currentTask ? (
                    <Tooltip content="ข้อความจากศูนย์ควบคุมจะค้างในหน้าคนขับจนกดรับทราบ">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${unreadCount ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-700"}`}>
                        <MessageCircle className="h-3.5 w-3.5" />
                        {unreadCount ? `${unreadCount} ข้อความใหม่` : "ส่งข้อความได้"}
                      </span>
                    </Tooltip>
                  ) : null}
                  <Tooltip content="GPS อ้างอิงจากตำแหน่งล่าสุดที่คนขับแชร์จากงานที่ผูกกับรถคันนี้">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      <MapPinned className="h-3.5 w-3.5" />
                      {gps.label}
                    </span>
                  </Tooltip>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <SmallMetric label="กำลังทำ" value={profile.currentTasks.length} />
                <SmallMetric label="งานคงเหลือ" value={profile.remainingTasks.length} />
                <SmallMetric label="ทำแล้ว" value={profile.completedTasks.length} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-operation ring-1 ring-slate-200 hover:ring-operation" href={`/resources/vehicles/${profile.vehicle.id}`}>
                  ดูรายละเอียดรถ
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {currentTask ? <VehicleMessageForm projectId={currentTask.assignment.projectId} assignmentId={currentTask.assignment.id} driverId={currentTask.assignment.driverId} /> : null}
              </div>
            </article>
          );
        })}
        {!profiles.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีรถที่ผูกกับโครงการนี้ กรุณาสร้างงานและเลือกรถก่อน</div>
        ) : null}
      </div>
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="text-lg font-semibold leading-none text-ink">{value}</p>
    </div>
  );
}
