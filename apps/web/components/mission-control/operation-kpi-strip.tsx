import { Activity, AlertTriangle, ClipboardList, RadioTower, ShieldCheck } from "lucide-react";

export function OperationKpiStrip({ readiness, assignments, liveDrivers, followUps, timeline }: { readiness: number; assignments: number; liveDrivers: number; followUps: number; timeline: number }) {
  const items = [
    { label: "ความพร้อมรวม", value: `${readiness}%`, detail: "จากงานและสัญญาณล่าสุด", icon: ShieldCheck, tone: "success" },
    { label: "Assignment ทั้งหมด", value: assignments, detail: "งานที่อยู่ในโครงการ", icon: ClipboardList, tone: "neutral" },
    { label: "GPS ล่าสุด", value: liveDrivers, detail: "คนขับที่ส่งตำแหน่ง", icon: RadioTower, tone: "route" },
    { label: "ต้องติดตาม", value: followUps, detail: "งานที่ควรตรวจทันที", icon: AlertTriangle, tone: followUps ? "warning" : "success" },
    { label: "Timeline", value: timeline, detail: "เหตุการณ์ที่บันทึกแล้ว", icon: Activity, tone: "pilot" }
  ];

  return (
    <section className="grid gap-3 md:grid-cols-5">
      {items.map((item) => (
        <Metric key={item.label} {...item} />
      ))}
    </section>
  );
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string | number; detail: string; icon: typeof Activity; tone: string }) {
  const styles: Record<string, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    route: "border-blue-200 bg-blue-50 text-blue-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    pilot: "border-violet-200 bg-violet-50 text-violet-800",
    neutral: "border-slate-200 bg-white text-slate-700"
  };

  return (
    <article className={`rounded-[20px] border p-4 shadow-[0_12px_30px_rgba(16,32,51,0.06)] ${styles[tone] ?? styles.neutral}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold opacity-80">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none text-ink">{value}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/75">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 min-h-8 text-[12px] leading-5 opacity-75">{detail}</p>
    </article>
  );
}
