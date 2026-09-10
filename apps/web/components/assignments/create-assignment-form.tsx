"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createAssignmentAction } from "@/app/actions/assignments";
import { DateRangeFields } from "@/components/ui/datetime-field";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { ConflictWarning } from "@/components/ui/conflict-warning";
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
  projectCode?: string;
  missions: Mission[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
  existingAssignments?: ExistingAssignmentWindow[];
}

function driverLabel(driver?: Driver) {
  if (!driver) return "ยังไม่ระบุคนขับ";
  return `${driver.fullName}${driver.phone ? ` / ${driver.phone}` : ""}`;
}

function vehicleLabel(vehicle?: Vehicle) {
  if (!vehicle) return "ยังไม่ระบุรถ";
  return `${vehicle.plateNumber}${vehicle.vehicleType ? ` / ${vehicle.vehicleType}` : ""}`;
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
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [isPending, startTransition] = useTransition();
  const availableCallSigns = callSigns;
  const [selectedCallSignId, setSelectedCallSignId] = useState(callSigns[0]?.id || "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const selectedCallSign = useMemo(
    () => availableCallSigns.find((callSign) => callSign.id === selectedCallSignId),
    [availableCallSigns, selectedCallSignId]
  );
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

  const canCreate = missions.length > 0 && selectedCrewReady;




  function handleSubmit(formData: FormData) {
    setMessage(null);

    if (!selectedCrewReady) {
      setTone("warning");
      setMessage("กรุณาผูกคนขับและรถให้ Call Sign ก่อนเปิดงานใหม่");
      return;
    }

    if (conflicts.length && !String(formData.get("overrideReason") || "").trim()) {
      setTone("danger");
      setMessage("ช่วงเวลาซ้ำกับงานเดิม กรุณาระบุเหตุผลก่อนเปิดงาน");
      return;
    }

    const parsed = createAssignmentSchema.safeParse({
      projectId,
      missionId: formData.get("missionId"),
      callSignId: selectedCallSignId || formData.get("callSignId"),
      startTime: formData.get("startTime") || null,
      endTime: formData.get("endTime") || null,
      metadata: {
        pickupLocation: formData.get("pickupLocation") || "ยังไม่ระบุจุดรับ",
        dropoffLocation: formData.get("dropoffLocation") || "ยังไม่ระบุจุดส่ง",
        driverInstruction: formData.get("driverInstruction") || "",
        ...(conflicts.length ? { overrideReason: String(formData.get("overrideReason") || "").trim(), overrideConflicts: conflicts } : {})
      }
    });

    if (!parsed.success) {
      setTone("warning");
      setMessage("กรุณาเลือกภารกิจ Call Sign และช่วงเวลางานให้ถูกต้อง");
      return;
    }

    startTransition(async () => {
      const result = await createAssignmentAction(parsed.data);
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "เปิดงานใหม่ไม่สำเร็จ");
        return;
      }
      setTone("success");
      setMessage(result.warning || "เปิดงานใหม่สำเร็จ ระบบบันทึกคนขับและรถจาก Call Sign แล้ว");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid content-start gap-5 p-4">
      <div className="border-b border-slate-100 pb-4">
        <p className="section-label">Call Sign เป็นหน่วยรถและคนขับ</p>
        <h2 className="text-lg font-semibold text-ink">เปิดงานใหม่</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          เลือก Call Sign ที่ผูกคนขับและรถไว้แล้ว ระบบจะบันทึกคนขับและรถลงในงานโดยอัตโนมัติ เพื่อลดการเลือกผิดระหว่างปฏิบัติการ
        </p>
      </div>

      {/* Crewing moved to ขั้นที่ 1. This form only opens work onto a unit that
          is already crewed, so the two decisions stop sharing a screen. */}
      <label className="field-label">
        หน่วยรถ (Call Sign)
        <select
          className="field-input"
          name="callSignId"
          value={selectedCallSignId}
          onChange={(event) => setSelectedCallSignId(event.target.value)}
          required
        >
          <option value="">เลือกหน่วยรถ</option>
          {availableCallSigns.map((callSign) => (
            <option key={callSign.id} value={callSign.id}>
              {callSign.callSign} - {driverLabel(driverById.get(callSign.driverId || ""))} - {vehicleLabel(vehicleById.get(callSign.vehicleId || ""))}
            </option>
          ))}
        </select>
        {selectedCallSign ? (
          <span className="mt-1 text-xs text-slate-500">
            คนขับและรถของงานนี้จะถูกบันทึกจากหน่วย {selectedCallSign.callSign} โดยอัตโนมัติ
          </span>
        ) : (
          <span className="mt-1 text-xs text-slate-500">ยังไม่มีหน่วยรถ? สร้างที่ “ขั้นที่ 1” ด้านบนก่อน</span>
        )}
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field-label">
          เลือกภารกิจ
          <select className="field-input" name="missionId" required>
            <option value="">เลือกภารกิจ</option>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.missionCode} / {mission.missionName}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-2">
          <DateRangeFields
            legend="ช่วงเวลางาน"
            startLabel="เวลาเริ่ม"
            endLabel="เวลาสิ้นสุด"
            startName="startTime"
            endName="endTime"
            start={startTime}
            end={endTime}
            onStart={setStartTime}
            onEnd={setEndTime}
            withTime
          />
        </div>
        <label className="field-label">
          จุดรับ
          <input className="field-input" name="pickupLocation" placeholder="เช่น ประตู 3 อาคารผู้โดยสาร" />
        </label>
        <label className="field-label">
          จุดส่ง
          <input className="field-input" name="dropoffLocation" placeholder="เช่น หน้าโรงแรมหรือสถานที่จัดงาน" />
        </label>
        <label className="field-label md:col-span-2">
          คำสั่งสำหรับคนขับ
          <textarea className="field-input min-h-24" name="driverInstruction" placeholder="เช่น โทรหาผู้ประสานงานก่อนถึงจุดรับ 10 นาที" />
        </label>
      </div>

      {!canCreate ? (
        <ActionFeedback
          tone="warning"
          message="ต้องมีภารกิจ และต้องผูก Call Sign กับคนขับและรถก่อน จึงจะเปิดงานและสร้าง QR สำหรับคนขับได้"
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
        {isPending ? "กำลังเปิดงาน..." : "เปิดงานใหม่"}
      </button>
    </form>
  );
}
