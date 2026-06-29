import type { Assignment } from "@tomp/types/domain";
import { AssignmentSummaryCard } from "@/components/assignments/assignment-summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

const assignments = [
  { callSign: "A-01", mission: "รับผู้โดยสารจากสนามบินรอบเช้า", driver: "สมชาย ใจดี", vehicle: "DEMO-1001", status: "draft" },
  { callSign: "B-02", mission: "รถรับส่งประจำจุดประชุม", driver: "รอเลือกคนขับ", vehicle: "รอเลือกรถ", status: "planning" }
];

export function AssignmentBoardPlaceholder({ assignments: liveAssignments }: { assignments?: Assignment[] }) {
  if (liveAssignments?.length) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">กระดาน Assignment</h2>
        <div className="mt-4 grid gap-3">
          {liveAssignments.map((assignment) => <AssignmentSummaryCard key={assignment.id} assignment={assignment} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-ink">กระดาน Assignment</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">ข้อมูลตัวอย่างสำหรับตรวจการจัดสรรภารกิจ Call Sign คนขับ รถ และช่วงเวลา</p>
      </div>
      <div className="divide-y divide-slate-200">
        {assignments.map((assignment) => (
          <div key={assignment.callSign} className="grid gap-3 p-5 md:grid-cols-[0.5fr_1fr_1fr_auto] md:items-center">
            <p className="font-semibold text-operation">{assignment.callSign}</p>
            <p className="text-sm text-slate-700">{assignment.mission}</p>
            <p className="text-sm text-slate-600">{assignment.driver} / {assignment.vehicle}</p>
            <StatusBadge label={formatStatusTh(assignment.status)} />
          </div>
        ))}
      </div>
    </section>
  );
}
