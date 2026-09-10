"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createAssignmentAction } from "@/app/actions/assignments";
import { createCallSignAction, updateCallSignCrewAction } from "@/app/actions/call-signs";
import { DateRangeFields } from "@/components/ui/datetime-field";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { ConflictWarning } from "@/components/ui/conflict-warning";
import { Tooltip } from "@/components/ui/tooltip";
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
  projectCode,
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
  const [isCrewPending, startCrewTransition] = useTransition();
  const [availableCallSigns, setAvailableCallSigns] = useState(callSigns);
  const [selectedCallSignId, setSelectedCallSignId] = useState(callSigns[0]?.id || "");
  const [newCallSign, setNewCallSign] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const selectedCallSign = useMemo(
    () => availableCallSigns.find((callSign) => callSign.id === selectedCallSignId),
    [availableCallSigns, selectedCallSignId]
  );
  const selectedDriver = selectedCallSign?.driverId ? driverById.get(selectedCallSign.driverId) : undefined;
  const selectedVehicle = selectedCallSign?.vehicleId ? vehicleById.get(selectedCallSign.vehicleId) : undefined;
  const selectedCrewReady = Boolean(selectedCallSign && isCallSignCrewed(selectedCallSign));

  useEffect(() => {
    setDriverId(selectedCallSign?.driverId || "");
    setVehicleId(selectedCallSign?.vehicleId || "");
  }, [selectedCallSign?.driverId, selectedCallSign?.vehicleId]);

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
  const crewChanged =
    Boolean(selectedCallSign && (driverId || null) !== (selectedCallSign.driverId || null)) ||
    Boolean(selectedCallSign && (vehicleId || null) !== (selectedCallSign.vehicleId || null));

  function upsertCallSignInState(callSign: CallSign) {
    setAvailableCallSigns((items) => {
      const exists = items.some((item) => item.id === callSign.id);
      return exists ? items.map((item) => (item.id === callSign.id ? callSign : item)) : [...items, callSign];
    });
    setSelectedCallSignId(callSign.id);
  }

  function handleCreateCallSign() {
    setMessage(null);
    if (!driverId || !vehicleId) {
      setTone("warning");
      setMessage("กรุณาเลือกคนขับและรถก่อนสร้าง Call Sign");
      return;
    }

    startCrewTransition(async () => {
      const result = await createCallSignAction({
        projectId,
        projectCode,
        callSign: newCallSign.trim() || null,
        driverId,
        vehicleId
      });
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้าง Call Sign ไม่สำเร็จ");
        return;
      }

      const callSign = (result.data as { callSign?: CallSign } | undefined)?.callSign;
      if (callSign) upsertCallSignInState(callSign);
      setNewCallSign("");
      setTone("success");
      setMessage(result.warning || `สร้าง Call Sign ${callSign?.callSign || ""} พร้อมคู่รถแล้ว`);
      router.refresh();
    });
  }

  function handleUpdateCrew() {
    setMessage(null);
    if (!selectedCallSign) {
      setTone("warning");
      setMessage("กรุณาเลือก Call Sign ก่อนบันทึกคู่รถ");
      return;
    }
    if (!driverId || !vehicleId) {
      setTone("warning");
      setMessage("กรุณาเลือกคนขับและรถให้ครบก่อนบันทึกคู่รถ");
      return;
    }

    startCrewTransition(async () => {
      const result = await updateCallSignCrewAction({
        projectId,
        callSignId: selectedCallSign.id,
        driverId,
        vehicleId,
        reason: "บันทึกคู่รถจากหน้าจัดสรรงาน",
        metadata: { source: "assignment_form" }
      });
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "บันทึกคู่รถของ Call Sign ไม่สำเร็จ");
        return;
      }

      const callSign = (result.data as { callSign?: CallSign } | undefined)?.callSign;
      if (callSign) upsertCallSignInState(callSign);
      setTone("success");
      setMessage(result.warning || "บันทึกคู่รถของ Call Sign แล้ว");
      router.refresh();
    });
  }

  function handleSubmit(formData: FormData) {
    setMessage(null);

    if (!selectedCrewReady) {
      setTone("warning");
      setMessage("กรุณาผูกคนขับและรถให้ Call Sign ก่อนเปิดงานใหม่");
      return;
    }

    if (crewChanged) {
      setTone("warning");
      setMessage("มีการเปลี่ยนคนขับหรือรถที่ยังไม่ได้บันทึก กรุณาบันทึกคู่รถก่อนเปิดงาน");
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

      <section className="grid gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink">คู่รถประจำ Call Sign</h3>
            <p className="text-xs leading-5 text-slate-600">QR ในเฟสนี้ยังคงเป็นแบบเดิม แต่การเปิดงานใหม่จะยึดคู่รถจาก Call Sign นี้</p>
          </div>
          <Tooltip content="Call Sign คือช่องปฏิบัติการของรถหนึ่งคันพร้อมคนขับหนึ่งคนในโครงการนี้">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-teal-200 bg-white text-xs font-bold text-teal-700">?</span>
          </Tooltip>
        </div>

        <label className="field-label">
          Call Sign
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
                {callSign.callSign} - {driverLabel(driverById.get(callSign.driverId || ""))} - {vehicleLabel(vehicleById.get(callSign.vehicleId || ""))}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="field-label">
            คนขับของ Call Sign
            <select className="field-input" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
              <option value="">เลือกคนขับ</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driverLabel(driver)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            รถของ Call Sign
            <select className="field-input" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              <option value="">เลือกรถ</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            className="field-input"
            value={newCallSign}
            onChange={(event) => setNewCallSign(event.target.value)}
            placeholder="รหัส Call Sign ใหม่ เช่น VAN-01 หรือเว้นว่างเพื่อให้ระบบสร้าง"
          />
          <button
            className="rounded-2xl border border-operation/30 bg-white px-4 py-2.5 text-sm font-semibold text-operation transition hover:bg-operation/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCrewPending || !driverId || !vehicleId}
            type="button"
            onClick={handleCreateCallSign}
          >
            สร้าง Call Sign
          </button>
          <button
            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isCrewPending || !selectedCallSign || !driverId || !vehicleId || !crewChanged}
            type="button"
            onClick={handleUpdateCrew}
          >
            บันทึกคู่รถ
          </button>
        </div>

        {selectedCallSign ? (
          <div className="grid gap-2 rounded-xl border border-teal-100 bg-white p-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-500">คนขับที่บันทึกอยู่</p>
              <p className="font-semibold text-ink">{driverLabel(selectedDriver)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">รถที่บันทึกอยู่</p>
              <p className="font-semibold text-ink">{vehicleLabel(selectedVehicle)}</p>
            </div>
          </div>
        ) : null}
      </section>

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
