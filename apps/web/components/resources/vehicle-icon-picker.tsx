"use client";

import type { ComponentType } from "react";
import { Bike, BusFront, CarFront, Truck, Van } from "lucide-react";

type VehicleIconKey = "sedan" | "suv" | "van" | "minibus" | "bus" | "pickup" | "truck" | "motorcycle";

type VehicleIconOption = {
  key: VehicleIconKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
};

const VEHICLE_ICON_OPTIONS: VehicleIconOption[] = [
  { key: "sedan", label: "รถเก๋ง", description: "ผู้โดยสาร 1-4 คน", icon: CarFront, tone: "from-sky-50 to-white text-sky-700 ring-sky-200" },
  { key: "suv", label: "SUV", description: "พื้นที่สัมภาระมาก", icon: CarFront, tone: "from-indigo-50 to-white text-indigo-700 ring-indigo-200" },
  { key: "van", label: "รถตู้", description: "ใช้งานรับส่งหลัก", icon: Van, tone: "from-teal-50 to-white text-teal-700 ring-teal-200" },
  { key: "minibus", label: "มินิบัส", description: "กลุ่มขนาดกลาง", icon: BusFront, tone: "from-emerald-50 to-white text-emerald-700 ring-emerald-200" },
  { key: "bus", label: "รถบัส", description: "กลุ่มขนาดใหญ่", icon: BusFront, tone: "from-amber-50 to-white text-amber-700 ring-amber-200" },
  { key: "pickup", label: "กระบะ", description: "งานอุปกรณ์/สัมภาระ", icon: Truck, tone: "from-orange-50 to-white text-orange-700 ring-orange-200" },
  { key: "truck", label: "รถบรรทุก", description: "ขนส่งอุปกรณ์", icon: Truck, tone: "from-slate-100 to-white text-slate-700 ring-slate-300" },
  { key: "motorcycle", label: "มอเตอร์ไซค์", description: "ประสานงานรวดเร็ว", icon: Bike, tone: "from-rose-50 to-white text-rose-700 ring-rose-200" }
];

export function VehicleIconPicker({ defaultValue = "van" }: { defaultValue?: VehicleIconKey }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {VEHICLE_ICON_OPTIONS.map(({ key, label, description, icon: Icon, tone }) => (
        <label key={key} className="group min-w-0 cursor-pointer">
          <input className="peer sr-only" type="radio" name="vehicleIcon" value={key} defaultChecked={key === defaultValue} />
          <span className="grid min-h-[5.25rem] min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-border bg-white px-2.5 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-operation/40 hover:shadow-md peer-checked:border-operation peer-checked:bg-operation-soft/70 peer-checked:ring-2 peer-checked:ring-operation/15">
            <span className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br shadow-inner ring-1 ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold leading-5 text-ink">{label}</span>
              <span className="block truncate text-[11px] font-medium leading-4 text-ink-faint">{description}</span>
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
