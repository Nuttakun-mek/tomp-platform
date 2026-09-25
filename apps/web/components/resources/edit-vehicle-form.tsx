"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateVehicleAction } from "@/app/actions/resources";
import { normaliseVehicleIcon } from "@/lib/domain/vehicle-icon";
import { VehicleIconPicker } from "./vehicle-icon-picker";
import { VEHICLE_TYPE_OPTIONS } from "./vehicle-type-options";

export interface EditableVehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
  metadata: Record<string, unknown>;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

// Closed by default: the page is for reading a vehicle's work; editing is the
// occasional fix (a mistyped plate, a wrong symbol).
export function EditVehicleForm({ vehicle }: { vehicle: EditableVehicle }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // Keep a type that is not in the list (older free-text values) selectable.
  const typeOptions = VEHICLE_TYPE_OPTIONS.includes(vehicle.vehicleType) || !vehicle.vehicleType ? VEHICLE_TYPE_OPTIONS : [vehicle.vehicleType, ...VEHICLE_TYPE_OPTIONS];

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateVehicleAction({
        id: vehicle.id,
        plateNumber: formData.get("plateNumber"),
        vehicleType: formData.get("vehicleType"),
        capacity: formData.get("capacity"),
        brand: formData.get("brand"),
        model: formData.get("model"),
        colour: formData.get("colour"),
        icon: formData.get("vehicleIcon")
      });
      if (result.success) {
        setMessage({ ok: true, text: "บันทึกข้อมูลรถแล้ว" });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error || "บันทึกข้อมูลรถไม่สำเร็จ" });
      }
    });
  }

  return (
    <details className="enterprise-panel group p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
        <Pencil className="h-4 w-4 text-operation" /> แก้ไขข้อมูลรถ
        <span className="text-xs font-normal text-ink-faint group-open:hidden">ทะเบียน ประเภท ที่นั่ง และสัญลักษณ์บนแผนที่</span>
      </summary>
      <form action={submit} className="clean-form mt-4 grid gap-3">
        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(7rem,0.62fr)]">
          <label className="field-label">
            <span className="field-title">ทะเบียนรถ <span className="field-required-badge">*</span></span>
            <input className="field-input" name="plateNumber" defaultValue={vehicle.plateNumber} required />
          </label>
          <label className="field-label">
            <span className="field-title">ประเภทรถ <span className="field-required-badge">*</span></span>
            <select className="field-input" name="vehicleType" defaultValue={vehicle.vehicleType} required>
              {typeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span className="field-title">จำนวนที่นั่ง <span className="field-required-badge">*</span></span>
            <input className="field-input" name="capacity" type="number" min={1} max={100} defaultValue={vehicle.capacity || ""} required />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="field-label">
            ยี่ห้อ
            <input className="field-input" name="brand" defaultValue={text(vehicle.metadata.brand)} />
          </label>
          <label className="field-label">
            รุ่น
            <input className="field-input" name="model" defaultValue={text(vehicle.metadata.model)} />
          </label>
          <label className="field-label">
            สี
            <input className="field-input" name="colour" defaultValue={text(vehicle.metadata.colour)} />
          </label>
        </div>
        <div className="grid gap-1.5">
          <span className="field-title">สัญลักษณ์บนแผนที่</span>
          <VehicleIconPicker defaultValue={normaliseVehicleIcon(vehicle.metadata.icon) ?? "van"} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className="rounded-xl bg-operation px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
            {pending ? "กำลังบันทึก..." : "บันทึกข้อมูลรถ"}
          </button>
          {message ? <span className={`text-xs font-semibold ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</span> : null}
        </div>
      </form>
    </details>
  );
}
