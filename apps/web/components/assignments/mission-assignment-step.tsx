"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Route, UsersRound } from "lucide-react";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { assignMissionToCallSignsAction } from "@/app/actions/call-signs";
import { createMissionAction } from "@/app/actions/missions";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { DateRangeFields, describeThai, todayLocalDate } from "@/components/ui/datetime-field";

const MISSION_TYPES = ["รับจากสนามบิน", "ส่งสนามบิน", "รับ-ส่งโรงแรม", "รถรับส่งในงาน", "รถรับรอง VIP", "รถสำรอง", "อื่น ๆ"];

const PRIORITIES = [
  { value: "normal", label: "ปกติ" },
  { value: "high", label: "เร่งด่วน" },
  { value: "critical", label: "เร่งด่วนมาก" },
  { value: "low", label: "ติดตามตามรอบ" }
];

function autoMissionCode(projectCode: string, existing: number) {
  const prefix = (projectCode || "MIS").split("-").pop()?.slice(0, 6).toUpperCase() || "MIS";
  return `${prefix}-${String(existing + 1).padStart(3, "0")}`;
}

function missionIdOf(callSign: CallSign) {
  const value = (callSign.metadata as Record<string, unknown> | undefined)?.missionId;
  return typeof value === "string" ? value : "";
}

function driverLabel(driver?: Driver) {
  if (!driver) return "ยังไม่ผูกคนขับ";
  return driver.phone ? `${driver.fullName} / ${driver.phone}` : driver.fullName;
}

function vehicleLabel(vehicle?: Vehicle) {
  if (!vehicle) return "ยังไม่ผูกรถ";
  return `${vehicle.plateNumber}${vehicle.vehicleType ? ` / ${vehicle.vehicleType}` : ""}`;
}

export function MissionAssignmentStep({
  projectId,
  projectCode,
  callSigns,
  missions,
  drivers,
  vehicles,
  projectStartDate,
  projectEndDate
}: {
  projectId: string;
  projectCode: string;
  callSigns: CallSign[];
  missions: Mission[];
  drivers: Driver[];
  vehicles: Vehicle[];
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}) {
  const router = useRouter();
  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const missionById = useMemo(() => new Map(missions.map((mission) => [mission.id, mission])), [missions]);
  const readyUnits = useMemo(
    () => callSigns.filter((item) => item.status === "active" && item.driverId && item.vehicleId),
    [callSigns]
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(readyUnits.filter((item) => !missionIdOf(item)).map((item) => item.id))
  );
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

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setMissionName("");
    setCommitment("");
    setStartDate("");
    setEndDate("");
    setSelected(new Set());
  }

  function submit() {
    setMessage(null);
    const callSignIds = Array.from(selected);
    if (!readyUnits.length) {
      setTone("warning");
      setMessage("ยังไม่มี Call Sign ที่ผูกคนขับและรถครบถ้วน กรุณาจัดเตรียมที่หน้าทรัพยากรโครงการก่อน");
      return;
    }
    if (!callSignIds.length) {
      setTone("warning");
      setMessage("เลือก Call Sign อย่างน้อย 1 รายการเพื่อกำหนดภารกิจหลัก");
      return;
    }
    if (!missionName.trim()) {
      setTone("warning");
      setMessage("กรอกชื่อภารกิจหลักก่อนบันทึก");
      return;
    }
    const from = startDate;
    const to = endDate || startDate;
    if (!from) {
      setTone("warning");
      setMessage("เลือกช่วงวันที่ของภารกิจหลัก");
      return;
    }
    if (to < from) {
      setTone("warning");
      setMessage("วันที่สิ้นสุดอยู่ก่อนวันที่เริ่ม กรุณาตรวจสอบอีกครั้ง");
      return;
    }

    startTransition(async () => {
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
        setMessage(missionResult.error || "สร้างภารกิจหลักไม่สำเร็จ");
        return;
      }

      const missionId = (missionResult.data as { mission?: { id?: string } } | undefined)?.mission?.id;
      if (!missionId) {
        setTone("danger");
        setMessage("สร้างภารกิจหลักแล้ว แต่ไม่พบรหัสภารกิจสำหรับกำหนดให้ Call Sign");
        return;
      }

      const assignResult = await assignMissionToCallSignsAction({ projectId, missionId, callSignIds });
      if (!assignResult.success) {
        setTone("danger");
        setMessage(assignResult.error || "กำหนดภารกิจหลักให้ Call Sign ไม่สำเร็จ");
        return;
      }

      setTone("success");
      setMessage(`กำหนดภารกิจหลักให้ Call Sign จำนวน ${callSignIds.length.toLocaleString("th-TH")} รายการแล้ว ขั้นถัดไปจึงสามารถเปิดงานย่อยและออก QR ได้`);
      reset();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      {message ? <ActionFeedback tone={tone} message={message} /> : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Call Sign ที่พร้อมรับภารกิจหลัก</p>
            <p className="text-xs leading-5 text-ink-soft">ข้อมูลนี้มาจากหน้าทรัพยากรโครงการ ต้องมีคนขับและรถครบก่อนจึงเลือกได้</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-operation shadow-sm">
            เลือกแล้ว {selected.size.toLocaleString("th-TH")} / {readyUnits.length.toLocaleString("th-TH")}
          </span>
        </div>

        {!readyUnits.length ? (
          <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-center text-sm font-semibold text-amber-900">
            ยังไม่มี Call Sign ที่พร้อมใช้งาน กรุณาไปที่หน้าทรัพยากรโครงการเพื่อสร้างหรือจับคู่คนขับกับรถก่อน
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {readyUnits.map((unit) => {
              const mission = missionById.get(missionIdOf(unit));
              const isSelected = selected.has(unit.id);
              const driver = unit.driverId ? driverById.get(unit.driverId) : undefined;
              const vehicle = unit.vehicleId ? vehicleById.get(unit.vehicleId) : undefined;
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => toggle(unit.id)}
                  aria-pressed={isSelected}
                  className={`grid min-w-0 gap-2 rounded-2xl border p-3 text-left transition focus-ring ${
                    isSelected ? "border-operation bg-operation-soft/70 shadow-sm" : "border-border bg-white hover:border-operation/40"
                  }`}
                >
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Call Sign</span>
                      <span className="block truncate text-lg font-bold text-ink">{unit.callSign}</span>
                    </span>
                    {isSelected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-operation" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" />}
                  </span>
                  <span className="grid gap-1 text-xs leading-5 text-ink-soft">
                    <span className="truncate">{driverLabel(driver)}</span>
                    <span className="truncate">{vehicleLabel(vehicle)}</span>
                    <span className={mission ? "font-semibold text-operation" : "font-semibold text-amber-700"}>
                      {mission ? `มีภารกิจหลักแล้ว: ${mission.missionName}` : "ยังไม่ได้กำหนดภารกิจหลัก"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
        <div className="flex items-start gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-operation-soft text-operation">
            <Route className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">สร้างภารกิจหลัก</p>
            <p className="text-xs leading-5 text-ink-soft">ภารกิจหลักเป็นกรอบงานของรถที่เลือกไว้ ขั้นนี้ยังไม่ออก QR</p>
          </div>
        </div>

        <label className="field-label">
          <span className="field-title">
            ชื่อภารกิจหลัก <span className="field-required-badge">*</span>
          </span>
          <input
            className="field-input"
            value={missionName}
            onChange={(event) => setMissionName(event.target.value)}
            placeholder="เช่น รับส่งผู้ร่วมงานจากสนามบิน รอบเช้า"
          />
        </label>

        <DateRangeFields
          legend="ช่วงวันที่ปฏิบัติการ"
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
            ระดับความสำคัญ
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
          ข้อกำหนดการบริการ
          <textarea
            className="field-input min-h-20"
            value={commitment}
            onChange={(event) => setCommitment(event.target.value)}
            placeholder="เช่น ถึงจุดรับก่อนเวลา 15 นาที และประสานงานกับผู้จัดงานก่อนปล่อยรถ"
          />
          <span className="field-hint">ใช้เป็นข้อความอ้างอิงสำหรับศูนย์ควบคุมและคนขับในงานย่อย</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-xs leading-5 text-ink-soft">
            <UsersRound className="h-4 w-4 shrink-0 text-operation" />
            {startDate ? `ภารกิจนี้ครอบคลุม ${describeThai(startDate, false)}${endDate && endDate !== startDate ? ` ถึง ${describeThai(endDate, false)}` : ""}` : "เลือกช่วงวันที่ก่อนบันทึก"}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !readyUnits.length}
            className="inline-flex h-11 items-center justify-center rounded-command bg-operation px-4 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300"
          >
            {isPending ? "กำลังบันทึก..." : "บันทึกภารกิจหลัก"}
          </button>
        </div>
      </section>
    </div>
  );
}
