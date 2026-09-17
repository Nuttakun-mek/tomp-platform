import { ArrowLeft, CalendarClock, Check, Circle, MapPin, Plane, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { completeAirportTransferTask } from "@/app/airport-transfer/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { getAirportTransferCase, getAirportTransferTasks } from "@/lib/airport-transfer/data";
import { operationalStatusLabel, verificationStatusLabel } from "@/lib/airport-transfer/labels";

function formatDateTime(value: string | null) {
  if (!value) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export default async function AirportTransferCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const [item, tasks] = await Promise.all([getAirportTransferCase(caseId), getAirportTransferTasks(caseId)]);
  if (!item) notFound();

  return (
    <>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <ButtonLink href="/airport-transfer/cases" variant="quiet" className="mb-3 gap-2 px-0"><ArrowLeft className="h-4 w-4" />กลับไปรายการ</ButtonLink>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">{item.caseCode}</p>
          <h1 className="mt-1 text-2xl font-semibold">{item.passengerName}</h1>
          <p className="mt-2 text-sm text-slate-500">{item.direction === "arrival" ? "รับเข้าจากสนามบิน" : "ส่งออกจากที่พัก"} · {item.flightNumber}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{verificationStatusLabel[item.verificationStatus]}</span>
          <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">{operationalStatusLabel[item.operationalStatus]}</span>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">ข้อมูลการเดินทาง</h2>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <Info icon={Plane} label="เที่ยวบิน" value={`${item.flightNumber} · ${item.originAirport || "—"} → ${item.destinationAirport || "—"}`} />
              <Info icon={CalendarClock} label="เวลารับ" value={formatDateTime(item.confirmedPickupAt || item.recommendedPickupAt)} />
              <Info icon={MapPin} label="เส้นทาง" value={`${item.pickupName} → ${item.dropoffName}`} />
              <Info icon={UserRound} label="ผู้โดยสาร" value={`${item.passengerCount} คน · ${item.luggageCount} กระเป๋า · ${item.passengerMobile || "ไม่มีเบอร์โทร"}`} />
            </dl>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">รถและคนขับ</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <p><span className="block text-xs text-slate-500">ประเภทรถ / ทะเบียน</span><strong>{item.vehicleType || "ยังไม่จัดรถ"} · {item.vehiclePlate || "—"}</strong></p>
              <p><span className="block text-xs text-slate-500">คนขับ / โทรศัพท์</span><strong>{item.driverName || "ยังไม่จัดคนขับ"} · {item.driverPhone || "—"}</strong></p>
            </div>
          </article>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">Operations Checklist</p><h2 className="mt-1 text-lg font-semibold">ขั้นตอนปฏิบัติงาน</h2></div><span className="text-sm tabular-nums text-slate-500">{tasks.filter((task) => task.status === "completed").length}/{tasks.length}</span></div>
          <ol className="mt-5 grid gap-2">
            {tasks.map((task) => {
              const completed = task.status === "completed";
              const action = completeAirportTransferTask.bind(null, item.id, task.id);
              return (
                <li key={task.id} className={`rounded-xl border p-3 ${completed ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${completed ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>{completed ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{task.label}</p><p className="mt-0.5 text-xs text-slate-500">{completed ? `สำเร็จ ${formatDateTime(task.completedAt)}` : task.ownerRole}</p></div>
                    {!completed ? <form action={action}><Button type="submit" variant="secondary" className="min-h-8 px-2.5 py-1 text-xs">ทำเสร็จแล้ว</Button></form> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>
      </section>
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Plane; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" /><div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-800">{value}</dd></div></div>;
}
