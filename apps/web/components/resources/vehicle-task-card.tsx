import Link from "next/link";
import type { VehicleOperationTask } from "@/lib/data/vehicle-operations";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { formatRelativeTh } from "@/lib/ui/relative-time";
import { CancelAssignmentButton } from "@/components/assignments/cancel-assignment-button";
import { Badge } from "@/components/ui/badge";

function timeLabel(value?: string | null) {
  if (!value) return "ยังไม่ระบุเวลา";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export function VehicleTaskCard({ task, allowCancel = false }: { task: VehicleOperationTask; allowCancel?: boolean }) {
  const assignment = task.assignment;
  const pickup = typeof assignment.metadata.pickupLocation === "string" ? assignment.metadata.pickupLocation : "ยังไม่ระบุจุดรับ";
  const dropoff = typeof assignment.metadata.dropoffLocation === "string" ? assignment.metadata.dropoffLocation : "ยังไม่ระบุจุดส่ง";

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-operation">{task.project?.projectCode || "ไม่พบรหัสโครงการ"}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-ink">{task.mission?.missionName || "ยังไม่ระบุภารกิจ"}</h3>
          <p className="mt-1 text-xs text-slate-500">Assignment {assignment.id.slice(0, 8)}</p>
        </div>
        <Badge label={formatStatusTh(assignment.status)} tone={assignment.status === "cancelled" ? "danger" : assignment.status === "completed" ? "success" : "info"} />
      </div>
      {task.reportedStatus ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          ● {formatStatusTh(task.reportedStatus.status)} · แจ้งโดยคนขับ {formatRelativeTh(task.reportedStatus.at)}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-sm text-slate-700">
        <div className="flex justify-between gap-3">
          <dt className="font-semibold">คนขับ</dt>
          <dd className="text-right">{task.driver?.fullName || "ยังไม่ระบุ"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-semibold">จุดรับ</dt>
          <dd className="text-right">{pickup}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-semibold">จุดส่ง</dt>
          <dd className="text-right">{dropoff}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-semibold">เวลา</dt>
          <dd className="text-right">{timeLabel(assignment.startTime)}</dd>
        </div>
      </dl>
      {task.evidence && (task.evidence.vehiclePhotoUrl || task.evidence.platePhotoUrl) ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-600">รูปตรวจรถจากคนขับ</p>
          <div className="mt-1 flex gap-2">
            {task.evidence.vehiclePhotoUrl ? (
              <a href={task.evidence.vehiclePhotoUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={task.evidence.vehiclePhotoUrl} alt="รูปรถ" className="h-16 w-24 rounded-lg border border-slate-200 object-cover" />
              </a>
            ) : null}
            {task.evidence.platePhotoUrl ? (
              <a href={task.evidence.platePhotoUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={task.evidence.platePhotoUrl} alt="รูปป้ายทะเบียน" className="h-16 w-24 rounded-lg border border-slate-200 object-cover" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link className="rounded-xl bg-operation px-3 py-2 text-center text-sm font-semibold text-white" href={`/projects/${assignment.projectId}/assignments`}>
          เปิดบอร์ดงาน
        </Link>
        {allowCancel ? <CancelAssignmentButton projectId={assignment.projectId} assignmentId={assignment.id} /> : null}
      </div>
    </article>
  );
}
