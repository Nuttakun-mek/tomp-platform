"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createAssignmentAction } from "@/app/actions/assignments";
import { DateRangeFields, DateTimeField, describeThai } from "@/components/ui/datetime-field";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { ConflictWarning } from "@/components/ui/conflict-warning";
import { ServiceTimeSummary } from "@/components/resources/service-time-summary";
import { dutyWindow, readDutySchedule } from "@/lib/domain/duty-hours";
import { checkSubJob, mainJobDays } from "@/lib/domain/job-schedule";
import { NEW_JOB_EVENT } from "./unit-schedule";
import { isCallSignCrewed } from "@/lib/domain/call-sign-rules";
import { createAssignmentSchema } from "@/lib/validation";

export interface ExistingAssignmentWindow {
  id: string;
  callSignId?: string | null;
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
  projectStartDate?: string | null;
  projectEndDate?: string | null;
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

function windowLabel(mission: Mission): string {
  const { from, to } = mainJobDays(mission);
  if (!from) return "";
  return from === to ? describeThai(from, false) : `${describeThai(from, false)} ถึง ${describeThai(to, false)}`;
}

export function CreateAssignmentForm({
  projectId,
  missions,
  callSigns,
  drivers,
  vehicles,
  existingAssignments = [],
  projectStartDate,
  projectEndDate
}: CreateAssignmentFormProps) {
  const router = useRouter();
  const availableCallSigns = useMemo(() => callSigns.filter((callSign) => Boolean(callSignMissionId(callSign))), [callSigns]);
  const [selectedCallSignId, setSelectedCallSignId] = useState("");
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

  const missionDays = useMemo(() => (mission ? mainJobDays(mission) : { from: "", to: "" }), [mission]);
  const operationDate = missionDays.from && missionDays.from === missionDays.to ? missionDays.from : jobDate;
  const startTime = operationDate && startClock ? bangkokLocalToUtcIso(operationDate, startClock) : "";
  const endTime = operationDate && endClock ? bangkokLocalToUtcIso(operationDate, endClock) : "";
  const selectedCrewReady = Boolean(selectedCallSign && isCallSignCrewed(selectedCallSign));

  // The same rules the server applies (lib/domain/job-schedule.ts): inside the
  // main job and the project, no overlap with this unit's other jobs. There is
  // no "book it anyway" — back to back is allowed, an overlap is not.
  // Soft warning only: a job may run past the day's clock-out on purpose — that
  // part is overtime (duty-hours.ts), so say so before it is booked.
  const dutyNote = useMemo(() => {
    if (!mission || !operationDate || !startTime || !endTime) return null;
    const hours = readDutySchedule(mission.metadata as Record<string, unknown> | undefined)[operationDate];
    if (!hours) return "ภารกิจหลักยังไม่ได้ตั้งเวลาเข้า-ออกงานของวันนี้ — ตั้งได้ที่การ์ด Call Sign ด้านล่าง";
    const window = dutyWindow(operationDate, hours);
    if (Date.parse(endTime) > Date.parse(window.end)) return `งานนี้เลยเวลาออกงาน ${hours.end} — ส่วนที่เกินจะคิดเป็น OT`;
    if (Date.parse(startTime) < Date.parse(window.start)) return `งานนี้เริ่มก่อนเวลาเข้างาน ${hours.start} — คนขับต้องเข้างานเร็วขึ้น (ไม่คิดเป็น OT)`;
    return null;
  }, [endTime, mission, operationDate, startTime]);

  const conflicts = useMemo(() => {
    if (!startTime || !endTime || !selectedCallSign) return [];
    const others = existingAssignments.filter(
      (item) =>
        item.callSignId === selectedCallSign.id ||
        (selectedCallSign.driverId && item.driverId === selectedCallSign.driverId) ||
        (selectedCallSign.vehicleId && item.vehicleId === selectedCallSign.vehicleId)
    );
    return checkSubJob({
      startTime,
      endTime,
      mainJob: mission ? mainJobDays(mission) : null,
      project: { startDate: projectStartDate, endDate: projectEndDate },
      others
    });
  }, [existingAssignments, selectedCallSign, startTime, endTime, mission, projectStartDate, projectEndDate]);

  const canCreate = Boolean(availableCallSigns.length && selectedCrewReady && mission?.id);

  // "+ งาน" on a day of a unit card (unit-schedule.tsx) picks the unit and the day.
  useEffect(() => {
    function prefill(event: Event) {
      const detail = (event as CustomEvent<{ callSignId?: string; date?: string }>).detail;
      if (!detail?.callSignId) return;
      setSelectedCallSignId(detail.callSignId);
      if (detail.date) setJobDate(detail.date);
      setStartClock("");
      setEndClock("");
      setMessage(null);
    }
    window.addEventListener(NEW_JOB_EVENT, prefill);
    return () => window.removeEventListener(NEW_JOB_EVENT, prefill);
  }, []);

  useEffect(() => {
    if (!selectedCallSignId) return;
    if (availableCallSigns.some((callSign) => callSign.id === selectedCallSignId)) return;
    setSelectedCallSignId("");
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
    if (conflicts.length) {
      setTone("danger");
      setMessage(conflicts[0]);
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
        driverInstruction: formData.get("driverInstruction") || ""
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
      setMessage(result.warning || "เปิดงานย่อยสำเร็จ — เวลาเริ่มของงานถัดไปตั้งต่อจากงานนี้ให้แล้ว");
      // The job just saved joins the list this form checks against, so keeping
      // its times on screen showed it "overlapping" itself. Start the next one
      // where this one ended (back to back is the usual case) and ask for its end.
      setStartClock(endClock);
      setEndClock("");
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
        {missionDays.from && missionDays.from !== missionDays.to ? (
          <div className="md:col-span-2 xl:max-w-2xl">
            <DateTimeField
            label="วันที่ของงานย่อย"
            name="jobDate"
            value={jobDate}
            onChange={setJobDate}
            min={missionDays.from}
            max={missionDays.to}
            required
            hint={`เลือกได้ระหว่าง ${describeThai(missionDays.from, false)} ถึง ${describeThai(missionDays.to, false)}`}
            />
          </div>
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
          <span className="field-hint">แสดงในหน้าคนขับ</span>
        </label>
      </div>

      {!canCreate ? (
        <ActionFeedback
          tone="warning"
          message="ต้องทำขั้นที่ 1 และมีคนขับกับรถครบก่อน"
        />
      ) : null}
      <ConflictWarning conflicts={conflicts} />
      {dutyNote && !conflicts.length ? (
        <p className="rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-900">{dutyNote}</p>
      ) : null}
      <ActionFeedback message={message} tone={tone} />
      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={!canCreate || isPending || conflicts.length > 0} type="submit">
        {isPending ? "กำลังเปิดงาน..." : "เปิดงานย่อย"}
      </button>
    </form>
  );
}
