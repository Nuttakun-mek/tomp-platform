import type { Assignment } from "@tomp/types/domain";
import Link from "next/link";

export function ProjectAssignmentBoard({ projectId, assignments }: { projectId: string; assignments: Assignment[] }) {
  const ready = assignments.filter((assignment) => assignment.driverId && assignment.vehicleId && assignment.callSignId).length;
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Assignments</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">งานที่จัดสรร</h2>
          <p className="mt-1 text-sm text-slate-600">พร้อมใช้งาน {ready} จาก {assignments.length} งาน</p>
        </div>
        <Link className="rounded-md bg-operation px-4 py-2.5 text-sm font-semibold text-white" href={`/projects/${projectId}/assignments`}>
          เปิด dispatch board
        </Link>
      </div>
    </section>
  );
}
