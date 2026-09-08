import Link from "next/link";
import { ArrowLeft, MapPinned, Plus } from "lucide-react";
import { VehicleProfileQr } from "@/components/resources/vehicle-profile-qr";
import { VehicleTaskCard } from "@/components/resources/vehicle-task-card";
import { Badge } from "@/components/ui/badge";
import { getVehicleOperationProfileById } from "@/lib/data/vehicle-operations";
import { formatStatusTh } from "@/lib/i18n/status-th";

export async function VehicleProfileDetail({ vehicleId }: { vehicleId: string }) {
  const profile = vehicleId ? await getVehicleOperationProfileById(vehicleId) : null;

  if (!profile) {
    return (
      <div className="grid gap-6">
        <section className="enterprise-panel p-5">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-operation" href="/resources/vehicles">
            <ArrowLeft className="h-4 w-4" />
            กลับไปศูนย์จัดการรถ
          </Link>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
            <p className="text-base font-semibold text-ink">ไม่พบข้อมูลรถคันนี้</p>
            <p className="mt-1">
              รถคันนี้อาจถูกลบไปแล้ว หรือคุณยังไม่มีสิทธิ์เข้าถึงรถในโครงการที่ผูกกับรถคันนี้ ลองกลับไปที่รายการรถแล้วเลือกใหม่อีกครั้ง
            </p>
          </div>
        </section>
      </div>
    );
  }

  const metadata = profile.vehicle.metadata || {};
  const requirements = Array.isArray(metadata.requirements) ? metadata.requirements.filter((item): item is string => typeof item === "string") : [];
  const note = typeof metadata.operationNote === "string" ? metadata.operationNote : "";

  return (
    <div className="grid gap-6">
      <section className="enterprise-panel p-5">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-operation" href="/resources/vehicles">
          <ArrowLeft className="h-4 w-4" />
          กลับไปศูนย์จัดการรถ
        </Link>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_auto]">
          <div>
            <p className="page-kicker">โปรไฟล์รถ</p>
            <h1 className="mt-1 page-title">{profile.vehicle.plateNumber || "ยังไม่ระบุทะเบียน"}</h1>
            <p className="mt-2 page-description">
              {profile.vehicle.vehicleType || "ยังไม่ระบุประเภทรถ"} / {profile.vehicle.capacity || 0} ที่นั่ง ใช้สำหรับตรวจคิวงาน สถานะ GPS และข้อกำหนดก่อนเริ่มงาน
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge label={formatStatusTh(profile.vehicle.status)} tone={profile.vehicle.status === "available" ? "success" : "info"} />
              <Badge label={`${profile.currentTasks.length} งานปัจจุบัน`} tone="info" />
              <Badge label={`${profile.remainingTasks.length} งานคงเหลือ`} tone="warning" />
              <Badge label={`${profile.completedTasks.length} งานที่ทำแล้ว`} tone="success" />
            </div>
          </div>
          <VehicleProfileQr vehicleId={profile.vehicle.id} plateNumber={profile.vehicle.plateNumber || "รถ"} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.68fr_1.32fr]">
        <section className="enterprise-panel grid content-start gap-4 p-5">
          <div>
            <p className="page-kicker">ข้อกำหนดก่อนรับงาน</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">สิ่งที่คนขับต้องดำเนินการ</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">ใช้เป็น checklist พื้นฐานของรถคันนี้ก่อนเริ่มงานจริง</p>
          </div>
          {requirements.length ? (
            <ul className="grid gap-2">
              {requirements.map((requirement) => (
                <li key={requirement} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  {requirement}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีข้อกำหนดเฉพาะรถคันนี้</p>
          )}
          {note ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">หมายเหตุปฏิบัติการ</p>
              <p className="mt-1 leading-6">{note}</p>
            </div>
          ) : null}
          {profile.latestLocation ? (
            <a
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white"
              href={`https://www.google.com/maps/search/?api=1&query=${profile.latestLocation.latitude},${profile.latestLocation.longitude}`}
              rel="noreferrer"
              target="_blank"
            >
              <MapPinned className="h-4 w-4" />
              เปิดตำแหน่งล่าสุดใน Google Maps
            </a>
          ) : null}
          <Link className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-operation hover:text-operation" href="/assignments">
            <Plus className="h-4 w-4" />
            เปิดงานใหม่ให้รถคันนี้
          </Link>
        </section>

        <section className="grid gap-4">
          <TaskGroup title="กำลังทำ / พร้อมออกงาน" tasks={profile.currentTasks} allowCancel />
          <TaskGroup title="งานคงเหลือ" tasks={profile.remainingTasks} allowCancel />
          <TaskGroup title="งานที่ทำแล้วและงานที่ถอน" tasks={[...profile.completedTasks, ...profile.cancelledTasks]} />
        </section>
      </div>
    </div>
  );
}

function TaskGroup({ title, tasks, allowCancel = false }: { title: string; tasks: NonNullable<Awaited<ReturnType<typeof getVehicleOperationProfileById>>>["currentTasks"]; allowCancel?: boolean }) {
  return (
    <div className="enterprise-panel grid gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{tasks.length}</span>
      </div>
      {tasks.length ? tasks.map((task) => <VehicleTaskCard key={task.assignment.id} task={task} allowCancel={allowCancel} />) : <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีรายการ</p>}
    </div>
  );
}
