"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createAssignmentAction } from "@/app/actions/assignments";
import { DateRangeFields, DateTimeField, describeThai } from "@/components/ui/datetime-field";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { ConflictWarning } from "@/components/ui/conflict-warning";
import { ServiceTimeSummary } from "@/components/resources/service-time-summary";
import { describeAssignmentConflicts } from "@/lib/domain/assignment-rules";
import { isCallSignCrewed } from "@/lib/domain/call-sign-rules";
import { createAssignmentSchema } from "@/lib/validation";

export interface ExistingAssignmentWindow {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  label?: string | null;
}

interface CreateAssignmentFormProps {
  projectId: string;
  missions: Mission[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
  existingAssignments?: ExistingAssignmentWindow[];
}

function callSignMissionId(callSign?: CallSign): string {
  const value = (callSign?.metadata as Record<string, unknown> | undefined)?.missionId;
  return typeof value === "string" ? value : "";
}

function driverLabel(driver?: Driver) {
  if (!driver) return "ยังไม่ระบุคนขับ";
  return `${driver.fullName}${driver.phone ? ` / ${driver.phone}` : ""}`;
}

function vehicleLabel(vehicle?: Vehicle) {
  if (!vehicle) return "ยังไม่ระบุรถ";
  return `${vehicle.plateNumber}${vehicle.vehicleType ? ` / ${vehicle.vehicleType}` : ""}`;
}

function bangkokLocalToUtcIso(date: string, clock: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0)).toISOString();
}

function missionWindow(mission: Mission): { from: string; to: string } {
  const meta = (mission.metadata ?? {}) as Record<string, unknown>;
  const metaFrom = typeof meta.operationStartDate === "string" ? meta.operationStartDate : typeof meta.operationDate === "string" ? meta.operationDate : "";
  const metaTo = typeof meta.operationEndDate === "string" ? meta.operationEndDate : "";
  const from = (metaFrom || (mission.plannedStartTime ? String(mission.plannedStartTime) : "")).slice(0, 10);
  const to = (metaTo || (mission.plannedEndTime ? String(mission.plannedEndTime) : "") || from).slice(0, 10);
  return { from, to: to || from };
}

function windowLabel(mission: Mission): string {
  const { from, to } = missionWindow(mission);
  if (!from) return "";
  return from === to ? describeThai(from, false) : `${describeThai(from, false)} ถึง ${describeThai(to, false)}`;
}

export function CreateAssignmentForm({
  projectId,
  missions,
  callSigns,
  drivers,
  vehicles,
  existingAssignments = []
}: CreateAssignmentFormProps) {
  const router = useRouter();
  const availableCallSigns = useMemo(() => callSigns.filter((callSign) => Boolean(callSignMissionId(callSign))), [callSigns]);
  const [selectedCallSignId, setSelectedCallSignId] = useState(() => availableCallSigns[0]?.id || "");
  const [jobDate, setJobDate] = useState("");
  const [startClock, setStartClock] = useState("");
  const [endClock, setEndClock] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [isPending, startTransition] = useTransition();

  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const selectedCallSign = useMemo(
    () => availableCallSigns.find((callSign) => callSign.id === selectedCallSignId),
    [availableCallSigns, selectedCallSignId]
  );
  const selectedDriver = selectedCallSign?.driverId ? driverById.get(selectedCallSign.driverId) : undefined;
  const selectedVehicle = selectedCallSign?.vehicleId ? vehicleById.get(selectedCallSign.vehicleId) : undefined;
  const mission = useMemo(() => {
    const missionId = callSignMissionId(selectedCallSign);
    return missionId ? missions.find((item) => item.id === missionId) : undefined;
  }, [missions, selectedCallSign]);

  const window = useMemo(() => (mission ? missionWindow(mission) : { from: "", to: "" }), [mission]);
  const operationDate = window.from && window.from === window.to ? window.from : jobDate;
  const startTime = operationDate && startClock ? bangkokLocalToUtcIso(operationDate, startClock) : "";
  const endTime = operationDate && endClock ? bangkokLocalToUtcIso(operationDate, endClock) : "";
  const selectedCrewReady = Boolean(selectedCallSign && isCallSignCrewed(selectedCallSign));

  const conflicts = useMemo(() => {
    if (!startTime || !endTime || !selectedCallSign) return [];
    const relevant = existingAssignments.filter(
      (item) =>
        (selectedCallSign.driverId && item.driverId === selectedCallSign.driverId) ||
        (selectedCallSign.vehicleId && item.vehicleId === selectedCallSign.vehicleId)
    );
    return describeAssignmentConflicts({ startTime, endTime }, relevant);
  }, [existingAssignments, selectedCallSign, startTime, endTime]);

  const canCreate = Boolean(availableCallSigns.length && selectedCrewReady && mission?.id);

  useEffect(() => {
    if (selectedCallSignId && availableCallSigns.some((callSign) => callSign.id === selectedCallSignId)) return;
    setSelectedCallSignId(availableCallSigns[0]?.id || "");
  }, [availableCallSigns, selectedCallSignId]);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    if (!availableCallSigns.length) {
      setTone("warning");
      setMessage("ยังไม่มี Call Sign ที่ผ่านขั้นที่ 1 กรุณากำหนดภารกิจหลักก่อนเปิดงานย่อย");
      return;
    }
    if (!selectedCrewReady || !selectedCallSign) {
      setTone("warning");
      setMessage("เลือก Call Sign ที่มีคนขับและรถครบถ้วนก่อนเปิดงานย่อย");
      return;
    }
    if (!mission?.id) {
      setTone("warning");
      setMessage("Call Sign นี้ยังไม่มีภารกิจหลัก กรุณากลับไปดำเนินการขั้นที่ 1");
      return;
    }
    if (!operationDate || !startClock || !endClock) {
      setTone("warning");
      setMessage("เลือกวันและช่วงเวลาของงานย่อยให้ครบถ้วน");
      return;
    }
    if (conflicts.length && !String(formData.get("overrideReason") || "").trim()) {
      setTone("danger");
      setMessage("ช่วงเวลาซ้ำกับงานเดิม กรุณาระบุเหตุผลก่อนเปิดงาน");
      return;
    }

    const parsed = createAssignmentSchema.safeParse({
      projectId,
      missionId: mission.id,
      callSignId: selectedCallSignId || formData.get("callSignId"),
      startTime,
      endTime,
      metadata: {
        pickupLocation: formData.get("pickupLocation") || "ยังไม่ระบุจุดรับ",
        dropoffLocation: formData.get("dropoffLocation") || "ยังไม่ระบุจุดส่ง",
        driverInstruction: formData.get("driverInstruction") || "",
        ...(conflicts.length ? { overrideReason: String(formData.get("overrideReason") || "").trim(), overrideConflicts: conflicts } : {})
      }
    });

    if (!parsed.success) {
      setTone("warning");
      setMessage("กรุณาตรวจสอบ Call Sign และช่วงเวลางานอีกครั้ง");
      return;
    }

    startTransition(async () => {
      const result = await createAssignmentAction(parsed.data);
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "เปิดงานย่อยไม่สำเร็จ");
        return;
      }
      setTone("success");
      setMessage(result.warning || "เปิดงานย่อยสำเร็จ ระบบบันทึกคนขับและรถจาก Call Sign แล้ว");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid content-start gap-5">
      <label className="field-label">
        <span className="field-title">
          Call Sign <span className="field-required-badge">*</span>
        </span>
        <select
          className="field-input"
          name="callSignId"
          value={selectedCallSignId}
          onChange={(event) => setSelectedCallSignId(event.target.value)}
          required
        >
          <option value="">เลือก Call Sign ที่ผ่านขั้นที่ 1</option>
          {availableCallSigns.map((callSign) => (
            <option key={callSign.id} value={callSign.id}>
              {callSign.callSign} - {driverLabel(driverById.get(callSign.driverId || ""))} - {vehicleLabel(vehicleById.get(callSign.vehicleId || ""))}
            </option>
          ))}
        </select>
        {selectedCallSign ? (
          <span className="mt-1 grid gap-2 text-xs">
            <span className="field-hint">ระบบใช้คนขับและรถจาก Call Sign นี้โดยอัตโนมัติ ไม่ต้องจับคู่ซ้ำในขั้นตอนเปิดงาน</span>
            <span className="grid gap-2 sm:grid-cols-3">
              <span className="rounded-xl border border-border bg-canvas/60 px-3 py-2">
                <span className="block text-[11px] font-semibold text-ink-faint">Call Sign</span>
                <span className="block truncate font-semibold text-ink">{selectedCallSign.callSign}</span>
              </span>
              <span className="rounded-xl border border-border bg-canvas/60 px-3 py-2">
                <span className="block text-[11px] font-semibold text-ink-faint">คนขับ</span>
                <span className="block truncate font-semibold text-ink">{driverLabel(selectedDriver)}</span>
              </span>
              <span className="rounded-xl border border-border bg-canvas/60 px-3 py-2">
                <span className="block text-[11px] font-semibold text-ink-faint">รถ</span>
                <span className="block truncate font-semibold text-ink">{vehicleLabel(selectedVehicle)}</span>
              </span>
            </span>
            {mission ? (
              <span className="font-semibold text-operation">
                ภารกิจหลัก: {mission.missionName}
                {windowLabel(mission) ? ` / ${windowLabel(mission)}` : ""}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="field-hint mt-1">ยังไม่มี Call Sign ที่พร้อมเปิดงานย่อย กรุณาดำเนินการขั้นที่ 1 ก่อน</span>
        )}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        {window.from && window.from !== window.to ? (
          <DateTimeField
            label="วันที่ของงานย่อย"
            name="jobDate"
            value={jobDate}
            onChange={setJobDate}
            min={window.from}
            max={window.to}
            required
            hint={`เลือกได้ระหว่าง ${describeThai(window.from, false)} ถึง ${describeThai(window.to, false)}`}
          />
        ) : null}

        <div className="md:col-span-2">
          <DateRangeFields
            legend={operationDate ? `ช่วงเวลางาน วันที่ ${describeThai(operationDate, false)}` : "ช่วงเวลางาน"}
            startLabel="เวลาเริ่ม"
            endLabel="เวลาสิ้นสุด"
            startName="startClock"
            endName="endClock"
            start={startClock}
            end={endClock}
            onStart={setStartClock}
            onEnd={setEndClock}
            timeOnly
            required
          />
          {startClock && endClock ? (
            <div className="mt-2">
              <ServiceTimeSummary start={startClock} end={endClock} packageHours="" />
            </div>
          ) : null}
          {!operationDate ? <p className="field-hint mt-1">ระบบต้องทราบวันที่ของงานก่อนจึงจะบันทึกช่วงเวลาได้</p> : null}
        </div>

        <label className="field-label">
          จุดรับ
          <input className="field-input" name="pickupLocation" placeholder="เช่น ประตู 3 อาคารผู้โดยสาร" />
          <span className="field-hint">หากไม่ระบุ ระบบจะแสดงว่า “ยังไม่ระบุจุดรับ”</span>
        </label>
        <label className="field-label">
          จุดส่ง
          <input className="field-input" name="dropoffLocation" placeholder="เช่น หน้าโรงแรมหรือสถานที่จัดงาน" />
          <span className="field-hint">หากไม่ระบุ ระบบจะแสดงว่า “ยังไม่ระบุจุดส่ง”</span>
        </label>
        <label className="field-label md:col-span-2">
          คำสั่งสำหรับคนขับ
          <textarea className="field-input min-h-24" name="driverInstruction" placeholder="เช่น โทรหาผู้ประสานงานก่อนถึงจุดรับ 10 นาที" />
          <span className="field-hint">ข้อความนี้จะแสดงในหน้าคนขับ ควรสั้น ชัดเจน และเป็นคำสั่งที่ปฏิบัติได้จริง</span>
        </label>
      </div>

      {!canCreate ? (
        <ActionFeedback
          tone="warning"
          message="ต้องกำหนดภารกิจหลักให้ Call Sign ในขั้นที่ 1 และต้องมีคนขับกับรถครบถ้วนก่อน จึงจะเปิดงานย่อยและออก QR ได้"
        />
      ) : null}
      <ConflictWarning conflicts={conflicts} />
      {conflicts.length ? (
        <label className="field-label">
          เหตุผลการจองซ้ำช่วงเวลา
          <textarea className="field-input min-h-20" name="overrideReason" placeholder="อธิบายเหตุผลที่ต้องให้ Call Sign นี้รับงานซ้อนช่วงเวลาเดิม" />
        </label>
      ) : null}
      <ActionFeedback message={message} tone={tone} />
      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={!canCreate || isPending} type="submit">
        {isPending ? "กำลังเปิดงาน..." : "เปิดงานย่อย"}
      </button>
    </form>
  );
}
