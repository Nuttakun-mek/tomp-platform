import { TriangleAlert } from "lucide-react";

interface ConflictWarningProps {
  conflicts: string[];
  className?: string;
  note?: string;
}

// Inline red bar shown when an assignment would double-book a driver/vehicle.
// The caller is responsible for requiring an override reason before submit.
export function ConflictWarning({
  conflicts,
  className,
  note = "ต้องระบุเหตุผลถ้าจะจองต่อ — ระบบจะบันทึกลง Timeline"
}: ConflictWarningProps) {
  if (!conflicts.length) return null;

  return (
    <div className={`grid gap-1.5 rounded-card border border-rose-200 bg-rose-50 p-3 text-rose-700 ${className ?? ""}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        ตรวจพบการจองซ้อนเวลา
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
