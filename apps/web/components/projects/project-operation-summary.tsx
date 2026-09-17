import { CarFront, Radio, Users, UserCheck } from "lucide-react";
import type { ProjectOperationSummary } from "@/lib/domain/project-operation-summary";

// Four facts about the operation, replacing a publish button, a job count that
// was already printed directly above it, and a percentage that measured nothing.
//
// Rendered on the server and never recomputed on the client, so the reporting
// figure is a snapshot rather than a live reading — the row says so. Live is
// what ศูนย์ควบคุม is for.

function Figure({
  icon: Icon,
  label,
  value,
  hint
}: {
  icon: typeof CarFront;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-xl border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <p className="text-2xl font-bold leading-none text-ink">{value}</p>
      {hint ? <p className="text-[11px] leading-4 text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function ProjectOperationSummaryPanel({ summary }: { summary: ProjectOperationSummary }) {
  const notCrewed = summary.totalUnits - summary.crewedUnits;

  return (
    <section className="enterprise-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">โครงการนี้ตอนนี้</h2>
        <p className="text-[11px] text-ink-faint">ข้อมูล ณ เวลาที่เปิดหน้า · ดูแบบสดได้ที่ศูนย์ควบคุม</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Figure icon={CarFront} label="รถในโครงการ" value={`${summary.vehicles}`} hint="คัน" />
        <Figure icon={Users} label="คนขับในโครงการ" value={`${summary.drivers}`} hint="คน" />
        <Figure
          icon={UserCheck}
          label="หน่วยพร้อมออกงาน"
          value={`${summary.crewedUnits}/${summary.totalUnits}`}
          hint={
            summary.totalUnits === 0
              ? "ยังไม่มีหน่วยรถ"
              : notCrewed > 0
                ? `อีก ${notCrewed} หน่วยยังไม่ได้จับคู่คนขับกับรถ`
                : "จับคู่ครบทุกหน่วย"
          }
        />
        <Figure
          icon={Radio}
          label="กำลังส่งตำแหน่ง"
          value={`${summary.reportingPositions}`}
          hint={summary.reportingPositions ? "หน่วยที่สัญญาณยังมาอยู่" : "ยังไม่มีหน่วยใดส่งตำแหน่ง"}
        />
      </div>
    </section>
  );
}
