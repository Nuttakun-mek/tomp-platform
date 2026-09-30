import { TriangleAlert } from "lucide-react";

interface ConflictWarningProps {
  conflicts: string[];
  className?: string;
  note?: string;
}

// Inline red bar listing why a sub-job's time cannot be saved (overlap, outside
// the main job or the project) — see lib/domain/job-schedule.ts. There is no
// override: the time has to change.
export function ConflictWarning({
  conflicts,
  className,
  note = "เปลี่ยนเวลาก่อนบันทึก — เริ่มต่อจากเวลาจบของงานก่อนหน้าได้พอดี"
}: ConflictWarningProps) {
  if (!conflicts.length) return null;

  return (
    <div className={`grid gap-1.5 rounded-card border border-rose-200 bg-rose-50 p-3 text-rose-700 ${className ?? ""}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        ช่วงเวลานี้ใช้ไม่ได้
      </p>
      <ul className="ml-6 list-disc text-[13px] leading-5">
        {conflicts.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="text-[12px] text-rose-600">{note}</p>
    </div>
  );
}
