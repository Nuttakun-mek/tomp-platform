"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CarFront, ChevronDown, Library, Trash2, UserRoundCheck } from "lucide-react";
import type { CallSign, Driver, Vehicle } from "@tomp/types/domain";
import {
  createExistingProjectResourcePairAction,
  deleteDriverAction,
  deleteVehicleAction,
  importDriversFromLibraryAction,
  importVehiclesFromLibraryAction
} from "@/app/actions/resources";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { inferVehicleIcon, vehicleIconLabel } from "@/lib/domain/vehicle-icon";

// A project staffs itself: it holds its own copies of the people and vehicles it
// uses, taken from the central library or typed fresh. Copies rather than shared
// rows, because availability, notes and edits are facts about *this* operation —
// a driver marked assigned on last week's event should not read as busy here.

type Kind = "driver" | "vehicle";

interface Row {
  id: string;
  primary: string;
  secondary: string;
  /** Why this record is not yet usable, or empty when it is fine. */
  missing: string;
}

const asDriverRow = (driver: Driver): Row => ({
  id: driver.id,
  primary: driver.fullName,
  secondary: [driver.phone, driver.licenseType].filter(Boolean).join(" · ") || "ไม่มีข้อมูลเพิ่มเติม",
  // Dispatch cannot reach a driver with no number, so it is flagged where the
  // record is, rather than on a separate readiness page nobody opened.
  missing: driver.phone ? "" : "ยังไม่มีเบอร์โทร"
});

const asVehicleRow = (vehicle: Vehicle): Row => ({
  id: vehicle.id,
  primary: vehicle.plateNumber,
  secondary: [
    vehicleIconLabel(inferVehicleIcon({ icon: vehicle.metadata.icon, vehicleType: vehicle.vehicleType, capacity: vehicle.capacity })),
    vehicle.vehicleType,
    vehicle.capacity ? `${vehicle.capacity} ที่นั่ง` : "",
    typeof vehicle.metadata.packageHours === "number" && typeof vehicle.metadata.packageAmount === "number"
      ? `ค่าใช้จ่ายในการบริการ ${vehicle.metadata.packageHours.toLocaleString("th-TH")} ชม. ${vehicle.metadata.packageAmount.toLocaleString("th-TH")} บ.`
      : typeof vehicle.metadata.hourlyRate === "number" ? `${vehicle.metadata.hourlyRate.toLocaleString("th-TH")} บ./ชม.` : ""
  ].filter(Boolean).join(" · "),
  missing: !vehicle.plateNumber ? "ยังไม่มีทะเบียน" : !vehicle.capacity ? "ยังไม่ระบุจำนวนที่นั่ง" : ""
});

function Section({
  kind, title, subtitle, icon, mine, library, projectId, usedBy
}: {
  kind: Kind;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  mine: Row[];
  library: Row[];
  /** Empty in library mode: there is no project to import into. */
  projectId: string;
  /** Library mode only: how many projects have taken each record. */
  usedBy?: Map<string, number>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showLibrary, setShowLibrary] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function importPicked() {
    if (!picked.size) return;
    setMessage(null);
    startTransition(async () => {
      const action = kind === "driver" ? importDriversFromLibraryAction : importVehiclesFromLibraryAction;
      const result = await action({ projectId, ids: [...picked] });
      setTone(result.success ? "success" : "danger");
      setMessage(result.success ? `นำเข้า ${picked.size} รายการเข้าโครงการแล้ว` : result.error || "นำเข้าไม่สำเร็จ");
      if (result.success) {
        setPicked(new Set());
        setShowLibrary(false);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setMessage(null);
    startTransition(async () => {
      const action = kind === "driver" ? deleteDriverAction : deleteVehicleAction;
      const result = await action({ id, projectId });
      setTone(result.success ? "success" : "danger");
      // The refusal explains itself — it names the unit or the job still holding
      // this resource, which is what the operator has to go and clear.
      setMessage(result.success ? "ลบออกจากโครงการแล้ว" : result.error || "ลบไม่สำเร็จ");
      if (result.success) {
        setConfirmId(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="enterprise-panel grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-operation">{icon}</span>
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <p className="text-xs leading-5 text-slate-600">{subtitle}</p>
          </div>
        </div>
        {projectId ? (
          <button
            type="button"
            onClick={() => setShowLibrary((current) => !current)}
            className="flex min-h-9 items-center gap-1.5 rounded-command border border-slate-300 bg-white px-3 text-[12px] font-semibold text-ink-soft"
          >
            <Library className="h-3.5 w-3.5" /> นำเข้าจากคลังกลาง ({library.length})
          </button>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-ink-soft">{mine.length} รายการ</span>
        )}
      </div>

      {message ? <ActionFeedback tone={tone} message={message} /> : null}

      {showLibrary ? (
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-bold text-slate-600">เลือกรายการที่ต้องการนำเข้าโครงการนี้</p>
          {library.length === 0 ? (
            <p className="text-[13px] text-ink-soft">คลังกลางไม่มีรายการที่ยังไม่ได้นำเข้า</p>
          ) : (
            <>
              <div className="grid max-h-56 gap-1 overflow-y-auto">
                {library.map((row) => (
                  <label key={row.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={picked.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-ink">{row.primary}</span>
                      <span className="ml-2 text-xs text-ink-soft">{row.secondary}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={importPicked}
                disabled={isPending || !picked.size}
                className="w-fit rounded-command bg-operation px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
              >
                {isPending ? "กำลังนำเข้า..." : `นำเข้า ${picked.size} รายการ`}
              </button>
            </>
          )}
        </div>
      ) : null}

      {mine.length === 0 ? (
        <p className="rounded-card bg-slate-50 px-3 py-4 text-center text-[13px] text-ink-soft">
          {projectId
            ? "โครงการนี้ยังไม่มีรายการ — เพิ่มใหม่ด้านล่าง หรือนำเข้าจากคลังกลาง"
            : "คลังกลางยังว่าง — เพิ่มรายการด้านล่างเพื่อเก็บไว้ใช้ข้ามโครงการ"}
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {mine.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-slate-50 px-3 py-2">
              <span className="min-w-0">
                <span className="text-[13px] font-semibold text-ink">{row.primary}</span>
                <span className="ml-2 text-xs text-ink-soft">{row.secondary}</span>
                {row.missing ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                    {row.missing}
                  </span>
                ) : null}
                {usedBy?.get(row.id) ? (
                  <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-operation">
                    ใช้อยู่ {usedBy.get(row.id)} โครงการ
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => (confirmId === row.id ? remove(row.id) : setConfirmId(row.id))}
                className={`flex min-h-8 shrink-0 items-center gap-1 rounded-command px-2.5 text-[11px] font-semibold disabled:opacity-40 ${
                  confirmId === row.id ? "bg-rose-600 text-white" : "border border-rose-200 bg-white text-rose-700"
                }`}
              >
                <Trash2 className="h-3 w-3" />
                {confirmId === row.id ? "ยืนยันลบ" : "ลบ"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExistingResourcePairingPanel({
  projectId,
  drivers,
  vehicles,
  callSigns
}: {
  projectId: string;
  drivers: Driver[];
  vehicles: Vehicle[];
  callSigns: CallSign[];
}) {
  const router = useRouter();
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [callSign, setCallSign] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [isPending, startTransition] = useTransition();
  const pairedDrivers = new Set(callSigns.filter((item) => item.status !== "archived").map((item) => item.driverId).filter(Boolean) as string[]);
  const pairedVehicles = new Set(callSigns.filter((item) => item.status !== "archived").map((item) => item.vehicleId).filter(Boolean) as string[]);
  const freeDrivers = drivers.filter((driver) => !pairedDrivers.has(driver.id));
  const freeVehicles = vehicles.filter((vehicle) => !pairedVehicles.has(vehicle.id));
  const disabled = !freeDrivers.length || !freeVehicles.length;

  function submit() {
    setMessage(null);
    if (!driverId || !vehicleId) {
      setTone("warning");
      setMessage("เลือกคนขับและรถให้ครบก่อนสร้างหน่วยรถ");
      return;
    }
    startTransition(async () => {
      const result = await createExistingProjectResourcePairAction({
        projectId,
        callSign: callSign.trim() || null,
        driverId,
        vehicleId
      });
      setTone(result.success ? "success" : "danger");
      setMessage(result.success ? "สร้างหน่วยรถจากทรัพยากรที่มีอยู่แล้ว" : result.error || "สร้างหน่วยรถไม่สำเร็จ");
      if (result.success) {
        setDriverId("");
        setVehicleId("");
        setCallSign("");
        router.refresh();
      }
    });
  }

  return (
    <section className="enterprise-panel grid gap-3 p-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">สร้างหน่วยรถจากทรัพยากรที่มีอยู่</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            ใช้สำหรับคนขับและรถที่นำเข้าจากคลังกลาง หรือรายการที่สร้างแยกไว้แล้ว จับคู่ให้เสร็จในหน้าทรัพยากรโครงการนี้
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-operation-soft px-3 py-1 text-xs font-semibold text-operation">
            เหลือ {freeDrivers.length} คน / {freeVehicles.length} รถ
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            {open ? "ซ่อน" : "แสดง"}
            <ChevronDown className={`h-4 w-4 text-ink-faint transition ${open ? "rotate-180" : ""}`} />
          </span>
        </span>
      </button>
      {open ? (
        <>
      {message ? <ActionFeedback tone={tone} message={message} /> : null}
      {disabled ? (
        <p className="rounded-card border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[13px] text-ink-soft">
          ไม่มีคนขับหรือรถที่ยังว่างให้จับคู่ หากต้องการเพิ่มหน่วยใหม่ ให้เพิ่มชุดคนขับและรถด้านล่าง หรือนำเข้าจากคลังกลางก่อน
        </p>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(12rem,0.8fr)_auto] xl:items-end">
          <label className="field-label">
            คนขับ
            <select className="field-input" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
              <option value="">เลือกคนขับ</option>
              {freeDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.fullName}{driver.phone ? ` / ${driver.phone}` : ""}
                </option>
              ))}
            </select>
            <span className="field-hint">แสดงเฉพาะคนขับที่ยังไม่ได้ผูกกับหน่วยรถในโครงการนี้</span>
          </label>
          <label className="field-label">
            รถ
            <select className="field-input" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              <option value="">เลือกรถ</option>
              {freeVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plateNumber} / {vehicle.vehicleType}
                </option>
              ))}
            </select>
            <span className="field-hint">แสดงเฉพาะรถที่ยังไม่ได้ผูกกับหน่วยรถในโครงการนี้</span>
          </label>
          <label className="field-label">
            Call Sign
            <input className="field-input" value={callSign} onChange={(event) => setCallSign(event.target.value)} placeholder="เว้นว่างให้ระบบตั้งให้" />
            <span className="field-hint">ใช้เป็นรหัสประจำรถและคนขับในศูนย์ควบคุม หน้าคนขับ และ QR</span>
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !driverId || !vehicleId}
            className="min-h-11 rounded-command bg-operation px-4 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300 lg:w-fit xl:w-auto"
          >
            {isPending ? "กำลังสร้าง..." : "สร้าง Call Sign"}
          </button>
        </div>
      )}
        </>
      ) : null}
    </section>
  );
}

function UnitSummaryPanel({
  callSigns,
  drivers,
  vehicles
}: {
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const active = callSigns.filter((unit) => unit.status !== "archived");

  if (!active.length) return null;

  return (
    <section className="enterprise-panel grid gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">หน่วยรถพร้อมใช้งาน</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            หน่วยรถคือข้อมูลรวมของ Call Sign คนขับ และรถ ใช้ตรวจความพร้อมก่อนรับมอบภารกิจและเปิดงานย่อยในหน้าจัดการโครงการ
          </p>
        </div>
        <span className="rounded-full bg-operation-soft px-3 py-1 text-xs font-semibold text-operation">{active.length} หน่วย</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),18rem))] gap-2">
        {active.map((unit) => {
          const driver = unit.driverId ? driverById.get(unit.driverId) : null;
          const vehicle = unit.vehicleId ? vehicleById.get(unit.vehicleId) : null;
          return (
            <article key={unit.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{unit.callSign}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">{vehicle ? `${vehicle.plateNumber} / ${vehicle.vehicleType}` : "ยังไม่ได้ผูกรถ"}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">พร้อมจับงาน</span>
              </div>
              <dl className="mt-3 grid gap-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-faint">คนขับ</dt>
                  <dd className="min-w-0 truncate font-semibold text-ink">{driver?.fullName ?? "ยังไม่ได้ผูกคนขับ"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-faint">ขั้นต่อไป</dt>
                  <dd className="min-w-0 truncate font-semibold text-ink">รับมอบภารกิจในหน้าจัดการโครงการ</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ProjectResourceManager({
  projectId,
  drivers,
  vehicles,
  callSigns = [],
  libraryDrivers = [],
  libraryVehicles = [],
  driverUsage,
  vehicleUsage
}: {
  /** Empty string puts the panel in library mode. */
  projectId: string;
  drivers: Driver[];
  vehicles: Vehicle[];
  callSigns?: CallSign[];
  libraryDrivers?: Driver[];
  libraryVehicles?: Vehicle[];
  driverUsage?: Map<string, number>;
  vehicleUsage?: Map<string, number>;
}) {
  const inProject = Boolean(projectId);

  return (
    <div className="grid gap-4">
      {inProject ? <UnitSummaryPanel callSigns={callSigns} drivers={drivers} vehicles={vehicles} /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <Section
          kind="driver"
          title={inProject ? "คนขับในโครงการนี้" : "คนขับในคลังกลาง"}
          subtitle={
            inProject
              ? "เฉพาะของโครงการนี้ — แก้ไขหรือลบที่นี่ไม่กระทบโครงการอื่น"
              : "รายชื่อที่เก็บไว้ใช้ข้ามโครงการ โครงการจะนำเข้าไปเป็นสำเนาของตัวเอง"
          }
          icon={<UserRoundCheck className="h-5 w-5" />}
          mine={drivers.map(asDriverRow)}
          library={libraryDrivers.map(asDriverRow)}
          projectId={projectId}
          usedBy={inProject ? undefined : driverUsage}
        />
        <Section
          kind="vehicle"
          title={inProject ? "รถในโครงการนี้" : "รถในคลังกลาง"}
          subtitle={
            inProject
              ? "เฉพาะของโครงการนี้ — แก้ไขหรือลบที่นี่ไม่กระทบโครงการอื่น"
              : "โปรไฟล์รถที่เก็บไว้ใช้ข้ามโครงการ"
          }
          icon={<CarFront className="h-5 w-5" />}
          mine={vehicles.map(asVehicleRow)}
          library={libraryVehicles.map(asVehicleRow)}
          projectId={projectId}
          usedBy={inProject ? undefined : vehicleUsage}
        />
      </div>
    </div>
  );
}
