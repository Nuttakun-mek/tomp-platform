"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createCallSignAction } from "@/app/actions/call-signs";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";
import { createMissionAction } from "@/app/actions/missions";
import { createObserverAccessTokenAction } from "@/app/actions/observer-access";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { DateRangeFields, todayLocalDate } from "@/components/ui/datetime-field";
import type { UnitCredentials } from "./unit-credential-sheet";

// One card sets up a working unit end to end: who drives, what they drive, what
// they are here to do, and over which days. Crewing, the mission and the QR were
// three separate places, and setting up ten vehicles meant thirty trips around
// the screen.
//
// Each unit gets its own mission, typed fresh. That makes unit and mission
// one-to-one, which is why opening work later only asks which unit — asking for
// the mission again would be asking the same question twice.

const MISSION_TYPES = ["รับจากสนามบิน", "ส่งสนามบิน", "รับ-ส่งโรงแรม", "รถรับส่งในงาน", "รถรับรอง VIP", "รถสำรอง / สแตนด์บาย", "อื่น ๆ"];
const PRIORITIES = [
  { value: "low", label: "ไม่เร่งด่วน" },
  { value: "normal", label: "ปกติ" },
  { value: "high", label: "ด่วน" },
  { value: "critical", label: "ด่วนที่สุด" }
];

function autoMissionCode(projectCode: string, existing: number) {
  const prefix = (projectCode || "MIS").split("-").pop()?.slice(0, 6).toUpperCase() || "MIS";
  return `${prefix}-${String(existing + 1).padStart(3, "0")}`;
}

export function UnitSetupForm({
  projectId,
  projectCode,
  callSigns,
  missions,
  drivers,
  vehicles,
  projectStartDate,
  projectEndDate,
  onIssued
}: {
  projectId: string;
  projectCode: string;
  callSigns: CallSign[];
  missions: Mission[];
  drivers: Driver[];
  vehicles: Vehicle[];
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  /** Hands the freshly issued credentials to the unit's card below. */
  onIssued: (credentials: UnitCredentials) => void;
}) {
  const router = useRouter();
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [unitName, setUnitName] = useState("");
  const [missionName, setMissionName] = useState("");
  const [missionType, setMissionType] = useState(MISSION_TYPES[0]);
  const [priority, setPriority] = useState("normal");
  const [commitment, setCommitment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [isPending, startTransition] = useTransition();

  const minDate = useMemo(() => {
    const today = todayLocalDate();
    return projectStartDate && projectStartDate > today ? projectStartDate : today;
  }, [projectStartDate]);

  // One person drives one vehicle at a time and one vehicle carries one driver,
  // so anyone already crewed is off the list rather than offered and refused.
  const takenDrivers = new Set(callSigns.map((cs) => cs.driverId).filter(Boolean) as string[]);
  const takenVehicles = new Set(callSigns.map((cs) => cs.vehicleId).filter(Boolean) as string[]);
  const freeDrivers = drivers.filter((driver) => !takenDrivers.has(driver.id));
  const freeVehicles = vehicles.filter((vehicle) => !takenVehicles.has(vehicle.id));

  function reset() {
    setDriverId("");
    setVehicleId("");
    setUnitName("");
    setMissionName("");
    setCommitment("");
    setStartDate("");
    setEndDate("");
  }

  async function issueCredentials(callSign: CallSign): Promise<UnitCredentials> {
    const QRCode = await import("qrcode");
    const toQr = (url: string) => (url ? QRCode.toDataURL(url, { margin: 2, width: 300, errorCorrectionLevel: "M" }) : Promise.resolve(null));

    const [driverResult, observerResult] = await Promise.all([
      createDriverAccessTokenAction({ projectId, callSignId: callSign.id, driverId: driverId || null }),
      createObserverAccessTokenAction({ projectId, callSignId: callSign.id })
    ]);

    const driverData = driverResult.success ? (driverResult.data as { accessUrl?: string; pin?: string }) : null;
    const observerData = observerResult.success ? (observerResult.data as { accessUrl?: string; trackUrl?: string }) : null;
    const driverUrl = driverData?.accessUrl || "";
    const observerUrl = observerData?.trackUrl || observerData?.accessUrl || "";
    const [driverQr, observerQr] = await Promise.all([toQr(driverUrl), toQr(observerUrl)]);

    const driver = drivers.find((item) => item.id === driverId);
    const vehicle = vehicles.find((item) => item.id === vehicleId);

    return {
      callSignId: callSign.id,
      callSignLabel: callSign.callSign,
      driverName: driver?.fullName ?? "ไม่ทราบชื่อคนขับ",
      vehicleLabel: vehicle ? `${vehicle.plateNumber} · ${vehicle.vehicleType}` : "ไม่ทราบรถ",
      driverUrl,
      driverQr,
      pin: driverData?.pin ?? null,
      observerUrl,
      observerQr
    };
  }

  function submit() {
    setMessage(null);

    if (!driverId || !vehicleId) {
      setTone("warning");
      setMessage("เลือกคนขับและรถให้ครบก่อนบันทึก");
      return;
    }
    if (!missionName.trim()) {
      setTone("warning");
      setMessage("กรอกชื่อภารกิจของหน่วยนี้");
      return;
    }
    const from = startDate;
    const to = endDate || startDate;
    if (!from) {
      setTone("warning");
      setMessage("เลือกช่วงวันปฏิบัติการของภารกิจ");
      return;
    }
    if (to < from) {
      setTone("warning");
      setMessage("วันสิ้นสุดอยู่ก่อนวันเริ่ม กรุณาตรวจสอบ");
      return;
    }

    startTransition(async () => {
      // The mission comes first: a unit with no mission has nothing to be
      // planned against, and a failure here should not leave a stray unit.
      const missionResult = await createMissionAction({
        projectId,
        missionCode: autoMissionCode(projectCode, missions.length),
        missionName: missionName.trim(),
        missionType,
        priority,
        plannedStartTime: `${from}T00:00`,
        plannedEndTime: `${to}T23:59`,
        instruction: commitment.trim() || null,
        metadata: { operationDate: from, operationStartDate: from, operationEndDate: to }
      });
      if (!missionResult.success) {
        setTone("danger");
        setMessage(missionResult.error || "สร้างภารกิจไม่สำเร็จ");
        return;
      }

      const missionId = (missionResult.data as { mission?: { id?: string } } | undefined)?.mission?.id ?? null;

      const unitResult = await createCallSignAction({
        projectId,
        projectCode,
        callSign: unitName.trim() || null,
        driverId,
        vehicleId,
        missionId
      });
      if (!unitResult.success) {
        setTone("danger");
        setMessage(unitResult.error || "สร้างหน่วยรถไม่สำเร็จ");
        return;
      }

      const created = (unitResult.data as { callSign?: CallSign } | undefined)?.callSign;
      if (created) {
        const sheet = await issueCredentials(created);
        onIssued(sheet);
        setTone(sheet.driverQr ? "success" : "warning");
        setMessage(
          sheet.driverQr
            ? `สร้างหน่วย ${created.callSign} และออก QR แล้ว — ดู QR กับรหัส 6 หลักได้ที่การ์ดของหน่วยนี้ด้านล่าง`
            : "สร้างหน่วยรถแล้ว แต่ออก QR ไม่สำเร็จ ลองออกอีกครั้งจากการ์ดของหน่วยนี้"
        );
      }

      reset();
      router.refresh();
    });
  }

  const blocked = !freeDrivers.length || !freeVehicles.length;

  return (
    <div className="grid gap-4">
      {message ? <ActionFeedback tone={tone} message={message} /> : null}

      {blocked ? (
        <p className="rounded-card bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
          {!drivers.length || !vehicles.length
            ? "โครงการนี้ยังไม่มีคนขับหรือรถ — เพิ่มหรือนำเข้าที่เมนู “ทรัพยากร” ก่อน"
            : "คนขับและรถทั้งหมดถูกจับคู่ไปแล้ว เพิ่มทรัพยากรใหม่หากต้องการหน่วยเพิ่ม"}
        </p>
      ) : null}

      <fieldset className="grid gap-3 rounded-2xl border border-teal-100 bg-teal-50/50 p-3 lg:grid-cols-3">
        <legend className="px-1 text-xs font-bold text-teal-800">หน่วยรถ</legend>
        <label className="field-label">
          คนขับ <span className="text-rose-500">*</span>
          <select className="field-input" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
            <option value="">เลือกคนขับ</option>
            {freeDrivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName}
                {driver.phone ? ` (${driver.phone})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          รถ <span className="text-rose-500">*</span>
          <select className="field-input" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">เลือกรถ</option>
            {freeVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plateNumber} · {vehicle.vehicleType}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          ชื่อหน่วย (Call Sign)
          <input
            className="field-input"
            value={unitName}
            onChange={(event) => setUnitName(event.target.value)}
            placeholder="เว้นว่างให้ระบบตั้งให้"
          />
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <legend className="px-1 text-xs font-bold text-slate-600">ภารกิจของหน่วยนี้</legend>

            <label className="field-label">
              ชื่อภารกิจ <span className="text-rose-500">*</span>
              <input
                className="field-input"
                value={missionName}
                onChange={(event) => setMissionName(event.target.value)}
                placeholder="เช่น รับผู้ร่วมงานจากสนามบิน รอบเช้า"
              />
            </label>

            <DateRangeFields
              legend="ช่วงวันปฏิบัติการ"
              startLabel="วันเริ่ม"
              endLabel="วันสิ้นสุด"
              startName="operationStartDate"
              endName="operationEndDate"
              start={startDate}
              end={endDate}
              onStart={setStartDate}
              onEnd={setEndDate}
              min={minDate}
              max={projectEndDate || undefined}
              required
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                ประเภทภารกิจ
                <select className="field-input" value={missionType} onChange={(event) => setMissionType(event.target.value)}>
                  {MISSION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                ความสำคัญ
                <select className="field-input" value={priority} onChange={(event) => setPriority(event.target.value)}>
                  {PRIORITIES.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field-label">
              ข้อผูกพันด้านบริการ <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
              <textarea
                className="field-input min-h-20"
                value={commitment}
                onChange={(event) => setCommitment(event.target.value)}
                placeholder="เช่น ต้องถึงจุดรับก่อนเวลา 15 นาที และประสานงานกับผู้จัดงานก่อนปล่อยรถ"
              />
        </label>
      </fieldset>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || blocked}
        className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกหน่วยรถ และออก QR"}
      </button>
    </div>
  );
}
