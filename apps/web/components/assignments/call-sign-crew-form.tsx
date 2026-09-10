"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, UserPlus } from "lucide-react";
import type { CallSign, Driver, Vehicle } from "@tomp/types/domain";
import { createCallSignAction, updateCallSignCrewAction } from "@/app/actions/call-signs";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";
import { createObserverAccessTokenAction } from "@/app/actions/observer-access";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { UnitCredentialSheet, type UnitCredentials } from "./unit-credential-sheet";

// Crewing a unit and opening a job used to live in the same form. They are not
// the same kind of decision: a unit is crewed once and stands for the length of
// the project, while jobs are opened several times a day. Anyone who only wanted
// to open a second job still had to walk past the crewing controls, and anyone
// who only wanted to pair a vehicle had to open a form called "เปิดงานใหม่".

function driverLabel(driver?: Driver) {
  return driver ? `${driver.fullName}${driver.phone ? ` (${driver.phone})` : ""}` : "ยังไม่ผูกคนขับ";
}

function vehicleLabel(vehicle?: Vehicle) {
  return vehicle ? `${vehicle.plateNumber} · ${vehicle.vehicleType}` : "ยังไม่ผูกรถ";
}

export function CallSignCrewForm({
  projectId,
  projectCode,
  callSigns,
  drivers,
  vehicles
}: {
  projectId: string;
  projectCode: string;
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [isPending, startTransition] = useTransition();
  const [credentials, setCredentials] = useState<UnitCredentials | null>(null);

  // A person drives one vehicle at a time and a vehicle carries one driver, so
  // anyone already crewed elsewhere is out of the list rather than offered and
  // then rejected by the database.
  const takenDrivers = new Set(callSigns.filter((cs) => cs.id !== editing).map((cs) => cs.driverId).filter(Boolean) as string[]);
  const takenVehicles = new Set(callSigns.filter((cs) => cs.id !== editing).map((cs) => cs.vehicleId).filter(Boolean) as string[]);
  const freeDrivers = drivers.filter((d) => !takenDrivers.has(d.id));
  const freeVehicles = vehicles.filter((v) => !takenVehicles.has(v.id));

  function reset() {
    setDriverId("");
    setVehicleId("");
    setName("");
    setEditing("");
  }

  function submit() {
    if (!driverId || !vehicleId) {
      setTone("warning");
      setMessage("เลือกคนขับและรถให้ครบก่อนบันทึกหน่วยรถ");
      return;
    }
    setMessage(null);

    startTransition(async () => {
      const result = editing
        ? await updateCallSignCrewAction({ projectId, callSignId: editing, driverId, vehicleId, metadata: {} })
        : await createCallSignAction({ projectId, projectCode, callSign: name.trim() || null, driverId, vehicleId });

      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "บันทึกหน่วยรถไม่สำเร็จ");
        return;
      }
      if (editing) {
        setTone("success");
        setMessage("เปลี่ยนคนขับ/รถของหน่วยนี้แล้ว QR ที่ปริ้นไว้ยังใช้ได้ แต่ต้องออกรหัสใหม่ให้คนขับคนใหม่");
        reset();
        router.refresh();
        return;
      }

      const created = (result.data as { callSign?: CallSign } | undefined)?.callSign;
      if (!created) {
        setTone("success");
        setMessage("สร้างหน่วยรถแล้ว");
        reset();
        router.refresh();
        return;
      }

      // Issue both credentials straight away. Someone is standing there waiting
      // for the QR; making them find a second button is the whole complaint.
      const sheet = await issueCredentials(created, driverId, vehicleId);
      setCredentials(sheet);
      setTone(sheet.driverQr ? "success" : "warning");
      setMessage(
        sheet.driverQr
          ? "สร้างหน่วยรถและออก QR แล้ว รหัส 6 หลักแสดงครั้งเดียว กรุณาบันทึกหรือพิมพ์เก็บไว้"
          : "สร้างหน่วยรถแล้ว แต่ออก QR ไม่สำเร็จ ลองออกอีกครั้งจากรายการด้านล่าง"
      );
      reset();
      router.refresh();
    });
  }


  /** Driver QR + PIN and the view-only link, produced together for one unit. */
  async function issueCredentials(callSign: CallSign, driver: string, vehicle: string): Promise<UnitCredentials> {
    const QRCode = await import("qrcode");
    const toQr = (url: string) => (url ? QRCode.toDataURL(url, { margin: 2, width: 300, errorCorrectionLevel: "M" }) : Promise.resolve(null));

    const [driverResult, observerResult] = await Promise.all([
      createDriverAccessTokenAction({ projectId, callSignId: callSign.id, driverId: driver || null }),
      createObserverAccessTokenAction({ projectId, callSignId: callSign.id })
    ]);

    const driverData = driverResult.success ? (driverResult.data as { accessUrl?: string; pin?: string }) : null;
    const observerData = observerResult.success ? (observerResult.data as { accessUrl?: string; trackUrl?: string }) : null;
    const driverUrl = driverData?.accessUrl || "";
    const observerUrl = observerData?.trackUrl || observerData?.accessUrl || "";

    const [driverQr, observerQr] = await Promise.all([toQr(driverUrl), toQr(observerUrl)]);

    const driverRecord = drivers.find((item) => item.id === driver);
    const vehicleRecord = vehicles.find((item) => item.id === vehicle);

    return {
      callSignId: callSign.id,
      callSignLabel: callSign.callSign,
      driverName: driverRecord?.fullName ?? "ไม่ทราบชื่อคนขับ",
      vehicleLabel: vehicleRecord ? `${vehicleRecord.plateNumber} · ${vehicleRecord.vehicleType}` : "ไม่ทราบรถ",
      driverUrl,
      driverQr,
      pin: driverData?.pin ?? null,
      observerUrl,
      observerQr
    };
  }

  function startEdit(callSign: CallSign) {
    setEditing(callSign.id);
    setDriverId(callSign.driverId || "");
    setVehicleId(callSign.vehicleId || "");
    setName(callSign.callSign);
    setMessage(null);
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Link2 className="h-4 w-4 text-teal-700" />
          {editing ? "เปลี่ยนคนขับ / รถของหน่วยนี้" : "จับคู่คนขับกับรถ"}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">
          {editing
            ? "QR ที่ปริ้นไปแล้วยังใช้ได้ แต่ระบบจะออกรหัส 6 หลักใหม่ให้คนขับคนใหม่"
            : "หนึ่งหน่วย = คนขับหนึ่งคน + รถหนึ่งคัน ตั้งครั้งเดียวใช้ได้ทั้งโครงการ"}
        </p>
      </div>

      {message ? <ActionFeedback tone={tone} message={message} /> : null}
      {credentials ? <UnitCredentialSheet credentials={credentials} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field-label">
          คนขับ
          <select className="field-input" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
            <option value="">เลือกคนขับ</option>
            {freeDrivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driverLabel(driver)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          รถ
          <select className="field-input" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">เลือกรถ</option>
            {freeVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          ชื่อหน่วย (Call Sign)
          <input
            className="field-input"
            value={name}
            disabled={Boolean(editing)}
            onChange={(event) => setName(event.target.value)}
            placeholder="เว้นว่างให้ระบบตั้งให้"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !driverId || !vehicleId}
          className="flex items-center gap-1.5 rounded-command bg-operation px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          <UserPlus className="h-4 w-4" />
          {isPending ? "กำลังบันทึก..." : editing ? "บันทึกการเปลี่ยน" : "สร้างหน่วยรถ"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="rounded-command border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
          >
            ยกเลิก
          </button>
        ) : null}
      </div>

      {!editing && callSigns.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-teal-100 pt-2">
          <span className="text-xs font-semibold text-slate-500">แก้ไขหน่วยเดิม:</span>
          {callSigns.map((callSign) => (
            <button
              key={callSign.id}
              type="button"
              onClick={() => startEdit(callSign)}
              className="rounded-full border border-teal-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-teal-800"
            >
              {callSign.callSign}
            </button>
          ))}
        </div>
      ) : null}

      {!drivers.length || !vehicles.length ? (
        <p className="rounded-card bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
          ยังไม่มี{!drivers.length ? "คนขับ" : ""}
          {!drivers.length && !vehicles.length ? " และ" : ""}
          {!vehicles.length ? "รถ" : ""}ในระบบ เพิ่มที่เมนู “ทรัพยากร” ก่อน
        </p>
      ) : null}
    </div>
  );
}
