"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createAssignmentAction } from "@/app/actions/assignments";
import { createCallSignAction } from "@/app/actions/call-signs";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { ConflictWarning } from "@/components/ui/conflict-warning";
import { Tooltip } from "@/components/ui/tooltip";
import { describeAssignmentConflicts } from "@/lib/domain/assignment-rules";
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

export function CreateAssignmentForm({ projectId, projectCode, missions, callSigns, drivers, vehicles, existingAssignments = [] }: CreateAssignmentFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [isPending, startTransition] = useTransition();
  const [isCallSignPending, startCallSignTransition] = useTransition();
  const [availableCallSigns, setAvailableCallSigns] = useState(callSigns);
  const [selectedCallSignId, setSelectedCallSignId] = useState(callSigns[0]?.id || "");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const canCreate = missions.length > 0 && availableCallSigns.length > 0 && drivers.length > 0 && vehicles.length > 0;

  const conflicts = useMemo(() => {
    if (!startTime || !endTime || (!driverId && !vehicleId)) return [];
    const relevant = existingAssignments.filter(
      (item) => (driverId && item.driverId === driverId) || (vehicleId && item.vehicleId === vehicleId)
    );
    return describeAssignmentConflicts({ startTime, endTime }, relevant);
  }, [existingAssignments, driverId, vehicleId, startTime, endTime]);

  function handleSubmit(formData: FormData) {
    setMessage(null);

    if (conflicts.length && !String(formData.get("overrideReason") || "").trim()) {
      setTone("danger");
      setMessage("มีการจองซ้อนเวลา — ต้องระบุเหตุผลก่อนจึงจะสร้างงานได้");
      return;
    }
    const parsed = createAssignmentSchema.safeParse({
      projectId,
      missionId: formData.get("missionId"),
      callSignId: selectedCallSignId || formData.get("callSignId"),
      driverId: formData.get("driverId"),
      vehicleId: formData.get("vehicleId"),
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
      setMessage("กรุณาเลือกภารกิจ Call Sign คนขับ และรถให้ครบก่อนสร้างงาน");
      return;
    }

    startTransition(async () => {
      const result = await createAssignmentAction(parsed.data);
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างงานที่จัดสรรไม่สำเร็จ");
        return;
      }
      setTone("success");
      setMessage(result.warning || "สร้างงานสำเร็จ");
      router.refresh();
    });
  }

  function handleCreateCallSign() {
    setMessage(null);
    startCallSignTransition(async () => {
      const result = await createCallSignAction({ projectId, projectCode });
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้าง Call Sign ไม่สำเร็จ");
        return;
      }

      const callSign = (result.data as { callSign?: CallSign } | undefined)?.callSign;
      if (callSign) {
        setAvailableCallSigns((items) => [...items, callSign]);
        setSelectedCallSignId(callSign.id);
      }

      setTone("success");
      setMessage(result.warning || `สร้าง Call Sign ${callSign?.callSign || ""} สำเร็จ`);
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid content-start gap-4 p-4">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">เปิดงานใหม่</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          เลือกภารกิจ Call Sign คนขับ และรถ เพื่อสร้างงานที่คนขับจะรับผ่าน QR ได้
        </p>
      </div>

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
        <label className="field-label">
          <span className="flex items-center gap-2">
            Call Sign
            <Tooltip content="Call Sign คือรหัสสื่อสารในงาน เช่น A-01 หรือ VAN-12 ใช้ให้ศูนย์ควบคุมและคนขับอ้างอิงตรงกัน">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
            </Tooltip>
          </span>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              className="field-input"
              name="callSignId"
              value={selectedCallSignId}
              onChange={(event) => setSelectedCallSignId(event.target.value)}
              required
            >
              <option value="">เลือก Call Sign</option>
              {availableCallSigns.map((callSign) => (
                <option key={callSign.id} value={callSign.id}>
                  {callSign.callSign}
                </option>
              ))}
            </select>
            <button
              className="rounded-2xl border border-operation/30 px-4 py-2.5 text-sm font-semibold text-operation transition hover:bg-operation/10 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCallSignPending}
              type="button"
              onClick={handleCreateCallSign}
            >
              {isCallSignPending ? "กำลังสร้าง..." : "สร้าง Call Sign"}
            </button>
          </div>
        </label>
        <label className="field-label">
          เลือกคนขับ
          <select className="field-input" name="driverId" value={driverId} onChange={(event) => setDriverId(event.target.value)} required>
            <option value="" disabled>เลือกคนขับ</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName} / {driver.phone || "ยังไม่มีเบอร์"}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          เลือกรถ
          <select className="field-input" name="vehicleId" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required>
            <option value="" disabled>เลือกรถ</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plateNumber} / {vehicle.vehicleType}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          จุดรับ
          <input className="field-input" name="pickupLocation" placeholder="เช่น ประตู 3 อาคารผู้โดยสาร" />
        </label>
        <label className="field-label">
          จุดส่ง
          <input className="field-input" name="dropoffLocation" placeholder="เช่น หน้าโรงแรมหรือสถานที่จัดงาน" />
        </label>
        <label className="field-label">
          เวลาเริ่ม
          <input className="field-input" name="startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </label>
        <label className="field-label">
          เวลาสิ้นสุด
          <input className="field-input" name="endTime" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>
        <label className="field-label md:col-span-2">
          คำสั่งสำหรับคนขับ
          <textarea className="field-input min-h-24" name="driverInstruction" placeholder="เช่น โทรหาผู้ประสานงานก่อนถึงจุดรับ 10 นาที" />
        </label>
      </div>

      {!canCreate ? (
        <ActionFeedback
          tone="warning"
          message="ต้องมีภารกิจ Call Sign คนขับ และรถก่อน จึงจะสร้างงานและ QR ให้คนขับได้"
        />
      ) : null}
      <ConflictWarning conflicts={conflicts} />
      {conflicts.length ? (
        <label className="field-label">
          เหตุผลการจองซ้อน (จำเป็น)
          <textarea className="field-input min-h-20" name="overrideReason" placeholder="อธิบายเหตุผลที่ต้องจองคนขับ/รถ ทับช่วงเวลาเดิม" />
        </label>
      ) : null}
      <ActionFeedback message={message} tone={tone} />
      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={!canCreate || isPending} type="submit">
        {isPending ? "กำลังสร้างงาน..." : "สร้างงานที่จัดสรร"}
      </button>
    </form>
  );
}
