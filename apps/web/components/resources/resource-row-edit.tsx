"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Driver, Vehicle } from "@tomp/types/domain";
import { updateDriverAction, updateVehicleAction } from "@/app/actions/resources";
import { inferVehicleIcon } from "@/lib/domain/vehicle-icon";
import { VehicleIconPicker } from "./vehicle-icon-picker";
import { VEHICLE_TYPE_OPTIONS } from "./vehicle-type-options";

export type ResourceRecord = { kind: "driver"; record: Driver } | { kind: "vehicle"; record: Vehicle };

// Same list as the add-driver form.
const LANGUAGE_OPTIONS = ["ไทย", "อังกฤษ", "จีน", "ญี่ปุ่น"];

const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px]";
const label = "grid gap-1 text-[11px] font-semibold text-slate-600";
const group = "grid gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5";
const heading = "text-[11px] font-bold uppercase tracking-wide text-slate-500";

const meta = (record: { metadata: Record<string, unknown> }, key: string) => {
  const value = record.metadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const number = (form: FormData, key: string) => {
  const raw = text(form, key);
  return raw === "" ? undefined : Number(raw);
};

/**
 * Everything the add forms ask for, editable in place. Deleting and re-adding a
 * driver or vehicle would drop it from its Call Sign and jobs; editing keeps
 * every link.
 */
export function ResourceRowEdit({ item, onDone }: { item: ResourceRecord; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        item.kind === "driver"
          ? await updateDriverAction({
              id: item.record.id,
              fullName: text(form, "fullName"),
              phone: text(form, "phone"),
              licenseType: text(form, "licenseType"),
              languages: LANGUAGE_OPTIONS.filter((language) => form.get(`lang:${language}`) === "on"),
              nickname: text(form, "nickname"),
              licenseNumber: text(form, "licenseNumber"),
              licenseExpiry: text(form, "licenseExpiry"),
              emergencyContactName: text(form, "emergencyContactName"),
              emergencyContactPhone: text(form, "emergencyContactPhone"),
              note: text(form, "note")
            })
          : await updateVehicleAction({
              id: item.record.id,
              plateNumber: text(form, "plateNumber"),
              vehicleType: text(form, "vehicleType"),
              capacity: number(form, "capacity"),
              brand: text(form, "brand"),
              model: text(form, "model"),
              colour: text(form, "colour"),
              year: text(form, "year"),
              luggageCapacity: text(form, "luggageCapacity"),
              photoUrl: text(form, "photoUrl"),
              icon: text(form, "vehicleIcon") || undefined,
              packageHours: number(form, "packageHours"),
              packageAmount: number(form, "packageAmount"),
              costNote: text(form, "costNote"),
              requirements: text(form, "requirements").split("\n").map((line) => line.trim()).filter(Boolean),
              operationNote: text(form, "operationNote")
            });
      if (!result.success) {
        const fields = result.fieldErrors ? Object.values(result.fieldErrors).flat().filter(Boolean) : [];
        setError(fields[0] || result.error || "บันทึกไม่สำเร็จ");
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid gap-2.5 rounded-card border border-teal-200 bg-white p-3">
      {item.kind === "driver" ? <DriverFields driver={item.record} /> : <VehicleFields vehicle={item.record} />}
      {error ? <p className="text-[12px] font-semibold text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-8 items-center gap-1.5 rounded-command bg-operation px-3 text-[12px] font-semibold text-white disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} บันทึกการแก้ไข
        </button>
        <button type="button" onClick={onDone} disabled={pending} className="min-h-8 rounded-command border border-slate-300 px-3 text-[12px] font-semibold text-slate-600">
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

function DriverFields({ driver }: { driver: Driver }) {
  return (
    <>
      <div className={group}>
        <p className={heading}>ข้อมูลติดต่อ</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={label}>
            ชื่อ-นามสกุล *
            <input className={input} name="fullName" defaultValue={driver.fullName} required />
          </label>
          <label className={label}>
            เบอร์โทร *
            <input className={input} name="phone" inputMode="tel" defaultValue={driver.phone} required />
          </label>
          <label className={label}>
            ชื่อเล่น
            <input className={input} name="nickname" defaultValue={meta(driver, "nickname")} />
          </label>
        </div>
      </div>
      <div className={group}>
        <p className={heading}>ใบขับขี่และภาษา</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={label}>
            ประเภทใบขับขี่
            <input className={input} name="licenseType" defaultValue={driver.licenseType ?? ""} placeholder="เช่น ท.2, บ.2" />
          </label>
          <label className={label}>
            เลขใบขับขี่
            <input className={input} name="licenseNumber" defaultValue={meta(driver, "licenseNumber")} />
          </label>
          <label className={label}>
            วันหมดอายุ
            <input className={input} type="date" name="licenseExpiry" defaultValue={meta(driver, "licenseExpiry").slice(0, 10)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] text-slate-700">
          {LANGUAGE_OPTIONS.map((language) => (
            <label key={language} className="inline-flex items-center gap-1.5">
              <input type="checkbox" name={`lang:${language}`} defaultChecked={driver.languages?.includes(language)} /> {language}
            </label>
          ))}
        </div>
      </div>
      <div className={group}>
        <p className={heading}>ผู้ติดต่อฉุกเฉินและหมายเหตุ</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>
            ชื่อผู้ติดต่อฉุกเฉิน
            <input className={input} name="emergencyContactName" defaultValue={meta(driver, "emergencyContactName")} />
          </label>
          <label className={label}>
            เบอร์ผู้ติดต่อฉุกเฉิน
            <input className={input} name="emergencyContactPhone" inputMode="tel" defaultValue={meta(driver, "emergencyContactPhone")} />
          </label>
        </div>
        <label className={label}>
          หมายเหตุ
          <textarea className={`${input} h-16 py-1.5`} name="note" defaultValue={meta(driver, "note")} />
        </label>
      </div>
    </>
  );
}

function VehicleFields({ vehicle }: { vehicle: Vehicle }) {
  const types = !vehicle.vehicleType || VEHICLE_TYPE_OPTIONS.includes(vehicle.vehicleType) ? VEHICLE_TYPE_OPTIONS : [vehicle.vehicleType, ...VEHICLE_TYPE_OPTIONS];
  const requirements = Array.isArray(vehicle.metadata?.requirements) ? (vehicle.metadata.requirements as unknown[]).filter((line) => typeof line === "string").join("\n") : "";
  return (
    <>
      <div className={group}>
        <p className={heading}>ข้อมูลรถ</p>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <label className={label}>
            ทะเบียน *
            <input className={input} name="plateNumber" defaultValue={vehicle.plateNumber} required />
          </label>
          <label className={label}>
            ประเภทรถ *
            <select className={input} name="vehicleType" defaultValue={vehicle.vehicleType ?? ""} required>
              <option value="" disabled>
                เลือกประเภท
              </option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            ที่นั่ง *
            <input className={input} name="capacity" type="number" min={1} max={100} defaultValue={vehicle.capacity ?? ""} required />
          </label>
          <label className={label}>
            ยี่ห้อ
            <input className={input} name="brand" defaultValue={meta(vehicle, "brand")} />
          </label>
          <label className={label}>
            รุ่น
            <input className={input} name="model" defaultValue={meta(vehicle, "model")} />
          </label>
          <label className={label}>
            สี
            <input className={input} name="colour" defaultValue={meta(vehicle, "colour")} />
          </label>
          <label className={label}>
            ปี
            <input className={input} name="year" inputMode="numeric" defaultValue={meta(vehicle, "year")} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            สัมภาระ
            <input className={input} name="luggageCapacity" defaultValue={meta(vehicle, "luggageCapacity")} placeholder="เช่น กระเป๋าใหญ่ 4 ใบ" />
          </label>
          <label className={`${label} sm:col-span-3`}>
            ลิงก์รูปรถ
            <input className={input} name="photoUrl" type="url" defaultValue={meta(vehicle, "photoUrl")} placeholder="https://..." />
          </label>
        </div>
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold text-slate-600">สัญลักษณ์บนแผนที่</span>
          <VehicleIconPicker defaultValue={inferVehicleIcon({ icon: vehicle.metadata?.icon, vehicleType: vehicle.vehicleType, capacity: vehicle.capacity })} />
        </div>
      </div>
      <div className={group}>
        <p className={heading}>ค่าใช้จ่ายในการบริการ</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={label}>
            ราคาแพ็กเกจ (บ.)
            <input className={input} name="packageAmount" type="number" min={0} step="0.01" defaultValue={meta(vehicle, "packageAmount")} />
          </label>
          <label className={label}>
            ชั่วโมงในแพ็กเกจ
            <input className={input} name="packageHours" type="number" min={0.5} step="0.5" defaultValue={meta(vehicle, "packageHours")} />
          </label>
          <label className={label}>
            หมายเหตุค่าใช้จ่าย
            <input className={input} name="costNote" defaultValue={meta(vehicle, "costNote")} placeholder="เช่น รวมค่าน้ำมัน" />
          </label>
        </div>
      </div>
      <div className={group}>
        <p className={heading}>การตรวจรถและหมายเหตุ</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={label}>
            รายการตรวจก่อนออกรถ (บรรทัดละรายการ)
            <textarea className={`${input} h-20 py-1.5`} name="requirements" defaultValue={requirements} />
          </label>
          <label className={label}>
            หมายเหตุการใช้งาน
            <textarea className={`${input} h-20 py-1.5`} name="operationNote" defaultValue={meta(vehicle, "operationNote")} />
          </label>
        </div>
      </div>
    </>
  );
}
