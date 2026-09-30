import { Check } from "lucide-react";

export const IMPORT_STEPS = ["ส่งแบบฟอร์มให้ลูกค้า", "อัปโหลดไฟล์", "ตรวจและแก้แถวที่มีปัญหา", "เติมข้อมูลปฏิบัติการ", "เลือกและนำเข้า", "ติดตามที่ “ข้อมูลการเดินทาง”"] as const;

/**
 * Where the operator is in the import, the same strip on the import page and
 * on a file's check page, so the two read as one process.
 */
export function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] font-semibold">
      {IMPORT_STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                active ? "bg-operation text-white" : done ? "bg-operation-soft text-operation" : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${active ? "bg-white/25" : done ? "bg-operation text-white" : "bg-white"}`}>
                {done ? <Check className="h-2.5 w-2.5" /> : step}
              </span>
              {label}
            </span>
            {step < IMPORT_STEPS.length ? <span className="text-slate-300">›</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
