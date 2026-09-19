import { ArrowLeft, CalendarClock, Check, Circle, History, MapPin, Pencil, Plane, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { completeAirportTransferTask } from "@/app/airport-transfer/actions";
import { CaseLifecycleActions } from "@/components/airport-transfer/case-lifecycle-actions";
import { RefreshFlightButton } from "@/components/airport-transfer/refresh-flight-button";
import { Button, ButtonLink } from "@/components/ui/button";
import { getAirportTransferAuditLogs, getAirportTransferCase, getAirportTransferTasks, getLatestAirportTransferFlightSnapshot } from "@/lib/airport-transfer/data";
import { operationalStatusLabel, verificationStatusLabel } from "@/lib/airport-transfer/labels";
import { getProjectByCode } from "@/lib/data/projects";
import type { AirportTransferAuditLog } from "@/lib/airport-transfer/types";

function formatDateTime(value: string | null) {
  if (!value) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function delayLabel(scheduled: string | null, latest: string | null) {
  if (!scheduled || !latest) return "ยังคำนวณไม่ได้";
  const minutes = Math.round((new Date(latest).getTime() - new Date(scheduled).getTime()) / 60_000);
  if (Math.abs(minutes) < 5) return "ตรงเวลา";
  return minutes > 0 ? `ล่าช้า ${minutes} นาที` : `เร็วกว่าแผน ${Math.abs(minutes)} นาที`;
}

const fieldLabels: Record<string, string> = {
  direction: "ประเภทบริการ", client_name: "ลูกค้า/บริษัท", passenger_title: "คำนำหน้า", passenger_first_name: "ชื่อ", passenger_last_name: "นามสกุล",
  passenger_email: "อีเมล", passenger_mobile: "เบอร์โทร", passenger_count: "จำนวนผู้โดยสาร", luggage_count: "จำนวนกระเป๋า", travel_date: "วันเดินทาง",
  flight_number: "หมายเลขเที่ยวบิน", origin_airport: "สนามบินต้นทาง", destination_airport: "สนามบินปลายทาง", scheduled_departure_at: "เวลาออก", scheduled_arrival_at: "เวลาถึง",
  pickup_name: "จุดรับ", pickup_address: "ที่อยู่จุดรับ", pickup_maps_url: "Google Maps จุดรับ", dropoff_name: "จุดส่ง", dropoff_address: "ที่อยู่จุดส่ง", dropoff_maps_url: "Google Maps จุดส่ง",
  recommended_pickup_at: "เวลารับที่ระบบแนะนำ", confirmed_pickup_at: "เวลารับที่ยืนยัน", pickup_time_override_reason: "เหตุผลที่ปรับเวลารับ", vehicle_type: "ประเภทรถ", vehicle_plate_snapshot: "ทะเบียนรถ",
  driver_name_snapshot: "คนขับ", driver_phone_snapshot: "โทรศัพท์คนขับ", notes: "หมายเหตุ", operational_status: "สถานะงาน", flight_verification_status: "สถานะตรวจเที่ยวบิน",
  fast_track: "Fast Track", deleted_at: "ย้ายไปถังขยะ", cancelled_at: "เวลายกเลิก"
};

const flightEditKeys = new Set(["travel_date", "flight_number", "origin_airport", "destination_airport", "scheduled_departure_at", "scheduled_arrival_at"]);
const systemDerivedEditKeys = new Set(["flight_verification_status", "operational_status", "recommended_pickup_at", "next_action_at"]);

const actionLabels: Record<string, string> = { created: "สร้างเคส", updated: "แก้ไขข้อมูล", flight_refreshed: "อัปเดตเที่ยวบินจาก API", flight_auto_refreshed: "ระบบอัปเดตเที่ยวบินอัตโนมัติ", cancelled: "ยกเลิกงาน", moved_to_trash: "ย้ายไปข้อมูลที่ลบแล้ว", restored: "กู้คืนงาน", completed: "ทำ Checklist สำเร็จ" };

function displayAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function AirportTransferCasePage({ params, searchParams }: { params: Promise<{ projectCode: string; caseId: string }>; searchParams?: Promise<{ updated?: string; flightUpdated?: string }> }) {
  const { projectCode, caseId } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const query = searchParams ? await searchParams : {};
  const [item, tasks, auditLogs, latestFlight] = await Promise.all([getAirportTransferCase(caseId, project.id), getAirportTransferTasks(caseId), getAirportTransferAuditLogs(caseId), getLatestAirportTransferFlightSnapshot(caseId)]);
  if (!item) notFound();
  const latestManualUpdate = query.updated === "1" ? auditLogs.find((log) => log.action === "updated") : undefined;
  const changedKeys = latestManualUpdate
    ? Array.from(new Set([...Object.keys(latestManualUpdate.oldValue || {}), ...Object.keys(latestManualUpdate.newValue || {})])).filter((key) => !systemDerivedEditKeys.has(key))
    : [];
  const flightWasEdited = changedKeys.some((key) => flightEditKeys.has(key));

  return (
    <>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <ButtonLink href={`/projects/${projectCode}/airport-transfer/cases`} variant="quiet" className="mb-3 gap-2 px-0"><ArrowLeft className="h-4 w-4" />กลับไปรายการ</ButtonLink>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">{item.caseCode}</p>
          <h1 className="mt-1 text-2xl font-semibold">{item.passengerName}</h1>
          <p className="mt-2 text-sm text-slate-500">{item.direction === "arrival" ? "รับเข้าจากสนามบิน" : "ส่งออกจากที่พัก"} · {item.flightNumber}</p>
        </div>
        <div className="grid justify-items-end gap-2">
          <div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{verificationStatusLabel[item.verificationStatus]}</span><span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">{operationalStatusLabel[item.operationalStatus]}</span></div>
          {!item.deletedAt ? <div className="flex flex-wrap justify-end gap-2"><ButtonLink href={`/projects/${projectCode}/airport-transfer/cases/${item.id}/edit`} variant="secondary" className="gap-2"><Pencil className="h-4 w-4" />แก้ไขข้อมูล</ButtonLink><RefreshFlightButton caseId={item.id} /></div> : null}
        </div>
      </header>

      {latestManualUpdate ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">บันทึกการแก้ไขเรียบร้อย</p><p className="text-xs text-emerald-800">แสดงเฉพาะข้อมูลที่เปลี่ยนแปลงในครั้งนี้</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${flightWasEdited ? "bg-blue-100 text-blue-800" : "bg-white text-slate-600"}`}>ข้อมูลเที่ยวบิน: {flightWasEdited ? "มีการเปลี่ยนแปลง" : "ไม่เปลี่ยนแปลง"}</span></div>{changedKeys.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{changedKeys.map((key) => <div key={key} className="rounded-xl border border-emerald-200 bg-white p-3"><p className="text-xs font-bold text-slate-700">{fieldLabels[key] || key}</p><div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs"><span className="truncate text-slate-500">{displayAuditValue(latestManualUpdate.oldValue?.[key])}</span><span className="text-slate-300">→</span><span className="truncate font-semibold text-slate-900">{displayAuditValue(latestManualUpdate.newValue?.[key])}</span></div></div>)}</div> : <p className="mt-2 text-xs">ไม่พบข้อมูลหลักที่เปลี่ยนแปลง</p>}</section> : null}
      {query.flightUpdated === "1" ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">อัปเดตข้อมูลเที่ยวบินล่าสุดจาก API โดยอัตโนมัติแล้ว</div> : null}
      {query.flightUpdated === "0" ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">บันทึกข้อมูลแล้ว แต่ Flight API ไม่ตอบสนอง ระบบจะตรวจสอบอีกครั้งตามรอบอัตโนมัติ</div> : null}
      {item.deletedAt ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">เคสนี้อยู่ใน “ข้อมูลที่ลบแล้ว” ตั้งแต่ {formatDateTime(item.deletedAt)} และไม่ถูกนำไปติดตาม Flight API</div> : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">ข้อมูลการเดินทาง</h2>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <Info icon={Plane} label="เที่ยวบิน" value={`${item.flightNumber} · ${item.originAirport || "—"} → ${item.destinationAirport || "—"}`} />
              <Info icon={CalendarClock} label="เวลาออก / เวลาถึง" value={`${formatDateTime(item.scheduledDepartureAt)} → ${formatDateTime(item.scheduledArrivalAt)}`} />
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
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">ข้อมูลล่าสุดจาก Flight API</h2><span className="text-xs text-slate-500">ตรวจเมื่อ {formatDateTime(item.flightProviderCheckedAt)}</span></div>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
              <p><span className="block text-xs text-slate-500">สถานะจากผู้ให้บริการ</span><strong>{latestFlight?.providerStatus || "ยังไม่มีข้อมูล"}</strong></p>
              <p><span className="block text-xs text-slate-500">เวลาออกล่าสุด</span><strong>{formatDateTime(latestFlight?.actualDepartureAt || latestFlight?.estimatedDepartureAt || null)}</strong></p>
              <p><span className="block text-xs text-slate-500">เวลาถึงล่าสุด</span><strong>{formatDateTime(latestFlight?.actualArrivalAt || latestFlight?.estimatedArrivalAt || null)}</strong></p>
              <p><span className="block text-xs text-slate-500">เทียบกำหนดถึง</span><strong>{delayLabel(latestFlight?.scheduledArrivalAt || null, latestFlight?.actualArrivalAt || latestFlight?.estimatedArrivalAt || null)}</strong></p>
              <p><span className="block text-xs text-slate-500">Snapshot ล่าสุด</span><strong>{latestFlight ? formatDateTime(latestFlight.observedAt) : "—"}</strong></p>
            </div>
          </article>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">Operations Checklist</p><h2 className="mt-1 text-lg font-semibold">ขั้นตอนปฏิบัติงาน</h2></div><span className="text-sm tabular-nums text-slate-500">{tasks.filter((task) => task.status === "completed").length}/{tasks.length}</span></div>
          <ol className="mt-5 grid gap-2">
            {tasks.map((task, index) => {
              const completed = task.status === "completed";
              const canComplete = tasks.slice(0, index).every((earlier) => earlier.status !== "pending");
              const action = completeAirportTransferTask.bind(null, item.id, task.id);
              return (
                <li key={task.id} className={`rounded-xl border p-3 ${completed ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${completed ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>{completed ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{task.label}</p><p className="mt-0.5 text-xs text-slate-500">{completed ? `สำเร็จ ${formatDateTime(task.completedAt)}` : task.ownerRole}</p></div>
                    {!completed && canComplete && !item.deletedAt && item.operationalStatus !== "cancelled" ? <form action={action}><Button type="submit" variant="secondary" className="min-h-8 px-2.5 py-1 text-xs">ทำเสร็จแล้ว</Button></form> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>
      </section>
      {!item.deletedAt ? <CaseLifecycleActions caseId={item.id} status={item.operationalStatus} /> : null}
      <AuditHistory logs={auditLogs} />
    </>
  );
}

function AuditHistory({ logs }: { logs: AirportTransferAuditLog[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><History className="h-5 w-5 text-cyan-700" /><h2 className="font-semibold">ประวัติการแก้ไข</h2></div>
      <div className="mt-4 grid gap-3">
        {logs.length ? logs.map((log) => {
          const keys = Array.from(new Set([...Object.keys(log.oldValue || {}), ...Object.keys(log.newValue || {})])).filter((key) => !["updated_at"].includes(key));
          return <article key={log.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold">{actionLabels[log.action] || log.action}</p><p className="text-xs text-slate-500">{formatDateTime(log.occurredAt)} · {log.actorName || "ระบบอัตโนมัติ"}</p></div>{log.reason ? <p className="mt-1 text-xs text-slate-600">เหตุผล: {log.reason}</p> : null}{keys.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">รายการ</th><th className="pb-2">ค่าเดิม</th><th className="pb-2">ค่าใหม่</th></tr></thead><tbody>{keys.map((key) => <tr key={key} className="border-t border-slate-100"><td className="py-2 font-semibold">{fieldLabels[key] || key}</td><td className="py-2 text-slate-500">{displayAuditValue(log.oldValue?.[key])}</td><td className="py-2 text-slate-800">{displayAuditValue(log.newValue?.[key])}</td></tr>)}</tbody></table></div> : null}</article>;
        }) : <p className="text-sm text-slate-500">ยังไม่มีประวัติการแก้ไข</p>}
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Plane; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" /><div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-800">{value}</dd></div></div>;
}
