"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { updateDriverAction, updateVehicleAction } from "@/app/actions/resources";

export type DriverEdit = { kind: "driver"; fullName: string; phone: string; licenseType: string };
export type VehicleEdit = {
  kind: "vehicle";
  plateNumber: string;
  vehicleType: string;
  capacity: number | null;
  packageHours: number | null;
  packageAmount: number | null;
};
export type ResourceEdit = DriverEdit | VehicleEdit;

const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px]";

/**
 * Fix what was typed wrong in place. Deleting and re-adding a driver or
 * vehicle would drop it from its Call Sign and jobs; editing keeps every link.
 */
export function ResourceRowEdit({ id, initial, onDone }: { id: string; initial: ResourceEdit; onDone: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<DriverEdit> | Partial<VehicleEdit>) => setValues((current) => ({ ...current, ...patch }) as ResourceEdit);

  function save() {
    setError(null);
    startTransition(async () => {
      const result =
        values.kind === "driver"
          ? await updateDriverAction({ id, fullName: values.fullName, phone: values.phone, licenseType: values.licenseType })
          : await updateVehicleAction({
              id,
              plateNumber: values.plateNumber,
              vehicleType: values.vehicleType,
              capacity: values.capacity ?? undefined,
              packageHours: values.packageHours ?? undefined,
              packageAmount: values.packageAmount ?? undefined
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

  const num = (value: string) => (value.trim() === "" ? null : Number(value));

  return (
    <div className="grid gap-2 rounded-card border border-teal-200 bg-white p-3">
      {values.kind === "driver" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            ชื่อ-นามสกุล
            <input className={input} value={values.fullName} onChange={(event) => set({ fullName: event.target.value })} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            เบอร์โทร
            <input className={input} inputMode="tel" value={values.phone} onChange={(event) => set({ phone: event.target.value })} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            ประเภทใบขับขี่
            <input className={input} value={values.licenseType} onChange={(event) => set({ licenseType: event.target.value })} />
          </label>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            ทะเบียน
            <input className={input} value={values.plateNumber} onChange={(event) => set({ plateNumber: event.target.value })} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            ประเภทรถ
            <input className={input} value={values.vehicleType} onChange={(event) => set({ vehicleType: event.target.value })} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            ที่นั่ง
            <input className={input} type="number" min={1} value={values.capacity ?? ""} onChange={(event) => set({ capacity: num(event.target.value) })} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            แพ็กเกจ (ชม.)
            <input className={input} type="number" min={1} step="0.5" value={values.packageHours ?? ""} onChange={(event) => set({ packageHours: num(event.target.value) })} />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            ราคาแพ็กเกจ (บ.)
            <input className={input} type="number" min={0} step="50" value={values.packageAmount ?? ""} onChange={(event) => set({ packageAmount: num(event.target.value) })} />
          </label>
        </div>
      )}
      {error ? <p className="text-[12px] font-semibold text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={pending} className="inline-flex min-h-8 items-center gap-1.5 rounded-command bg-operation px-3 text-[12px] font-semibold text-white disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} บันทึก
        </button>
        <button type="button" onClick={onDone} disabled={pending} className="min-h-8 rounded-command border border-slate-300 px-3 text-[12px] font-semibold text-slate-600">
          ยกเลิก
        </button>
        {values.kind === "vehicle" ? (
          <Link href={`/resources/vehicles/${id}`} className="text-[12px] font-semibold text-operation hover:underline">
            ยี่ห้อ รุ่น สี สัญลักษณ์ →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
