import Link from "next/link";
import { CarFront, MapPinned, Plus } from "lucide-react";
import type { VehicleOperationProfile } from "@/lib/data/vehicle-operations";
import { VehicleProfileQr } from "@/components/resources/vehicle-profile-qr";
import { VehicleTaskCard } from "@/components/resources/vehicle-task-card";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { formatStatusTh } from "@/lib/i18n/status-th";

function gpsLabel(profile: VehicleOperationProfile) {
  if (!profile.latestLocation) return "ยังไม่มี GPS";
  const recorded = new Date(profile.latestLocation.recordedAt).getTime();
  const ageSeconds = Math.max(0, Math.round((Date.now() - recorded) / 1000));
  if (ageSeconds <= 35) return "GPS สด";
  if (ageSeconds <= 120) return "GPS ช้า";
  return "GPS ขาดช่วง";
}

export function VehicleOperationsBoard({ profiles }: { profiles: VehicleOperationProfile[] }) {
  return (
    <section className="enterprise-panel grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-kicker">Vehicle Operations</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">งานและสถานะของรถแต่ละคัน</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            ใช้หน้านี้เพื่อตรวจว่ารถคันใดกำลังทำงานอะไร เหลืองานกี่งาน งานไหนเสร็จแล้ว และมีสัญญาณ GPS ล่าสุดหรือไม่
          </p>
        </div>
        <Link className="inline-flex items-center gap-2 rounded-2xl bg-operation px-4 py-3 text-sm font-semibold text-white" href="/assignments">
          <Plus className="h-4 w-4" />
          เปิดงานใหม่
        </Link>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile) => (
          <article key={profile.vehicle.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-white">
                        <CarFront className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-xl font-semibold text-ink">{profile.vehicle.plateNumber || "ยังไม่ระบุทะเบียน"}</h3>
                        <p className="text-sm text-slate-600">
                          {profile.vehicle.vehicleType || "ยังไม่ระบุประเภทรถ"} / {profile.vehicle.capacity || 0} ที่นั่ง
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={formatStatusTh(profile.vehicle.status)} tone={profile.vehicle.status === "available" ? "success" : profile.vehicle.status === "out_of_service" ? "danger" : "info"} />
                    <Tooltip content="สี GPS อ้างอิงเวลาที่คนขับแชร์ตำแหน่งล่าสุดในงานที่ผูกกับรถคันนี้">
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        <MapPinned className="h-3.5 w-3.5" />
                        {gpsLabel(profile)}
                      </span>
                    </Tooltip>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Metric label="งานปัจจุบัน" value={profile.currentTasks.length} />
                  <Metric label="งานคงเหลือ" value={profile.remainingTasks.length} />
                  <Metric label="งานที่ทำแล้ว" value={profile.completedTasks.length} />
                  <Metric label="งานที่ถอน" value={profile.cancelledTasks.length} />
                </div>
              </div>
              <VehicleProfileQr vehicleId={profile.vehicle.id} plateNumber={profile.vehicle.plateNumber || "รถ"} />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <TaskColumn title="กำลังทำ / พร้อมออกงาน" tasks={profile.currentTasks} allowCancel />
              <TaskColumn title="งานคงเหลือ" tasks={profile.remainingTasks} allowCancel />
              <TaskColumn title="ประวัติงาน" tasks={[...profile.completedTasks, ...profile.cancelledTasks]} />
            </div>
          </article>
        ))}
        {!profiles.length ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            ยังไม่มีข้อมูลรถ กรุณาเพิ่มรถก่อนเริ่มจัดสรรงาน
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none text-ink">{value}</p>
    </div>
  );
}

function TaskColumn({ title, tasks, allowCancel = false }: { title: string; tasks: VehicleOperationProfile["currentTasks"]; allowCancel?: boolean }) {
  return (
    <div className="grid content-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{tasks.length}</span>
      </div>
      {tasks.length ? tasks.map((task) => <VehicleTaskCard key={task.assignment.id} task={task} allowCancel={allowCancel} />) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">ยังไม่มีรายการ</p>}
    </div>
  );
}
