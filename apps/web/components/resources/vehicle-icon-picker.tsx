"use client";

import type { ComponentType } from "react";
import { Bike, BusFront, CarFront, Plane, ShipWheel, Truck, Van } from "lucide-react";
import type { VehicleIconKey } from "@/lib/domain/vehicle-icon";

type VehicleIconOption = {
  key: VehicleIconKey;
  label: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  emoji?: string;
  tone: string;
};

const VEHICLE_ICON_OPTIONS: VehicleIconOption[] = [
  { key: "sedan", label: "รถเก๋ง", description: "ผู้โดยสาร 1-4 คน", icon: CarFront, tone: "from-sky-50 to-white text-sky-700 ring-sky-200" },
  { key: "suv", label: "SUV", description: "พื้นที่สัมภาระมาก", icon: CarFront, tone: "from-indigo-50 to-white text-indigo-700 ring-indigo-200" },
  { key: "van", label: "รถตู้", description: "รับส่งหลัก", icon: Van, tone: "from-teal-50 to-white text-teal-700 ring-teal-200" },
  { key: "minibus", label: "มินิบัส", description: "กลุ่มขนาดกลาง", icon: BusFront, tone: "from-emerald-50 to-white text-emerald-700 ring-emerald-200" },
  { key: "bus", label: "รถบัส", description: "กลุ่มขนาดใหญ่", icon: BusFront, tone: "from-amber-50 to-white text-amber-700 ring-amber-200" },
  { key: "pickup", label: "กระบะ", description: "อุปกรณ์/สัมภาระ", icon: Truck, tone: "from-orange-50 to-white text-orange-700 ring-orange-200" },
  { key: "truck", label: "รถบรรทุก", description: "ขนส่งอุปกรณ์", icon: Truck, tone: "from-slate-100 to-white text-slate-700 ring-slate-300" },
  { key: "motorcycle", label: "มอเตอร์ไซค์", description: "ประสานงานเร็ว", icon: Bike, tone: "from-rose-50 to-white text-rose-700 ring-rose-200" },
  { key: "vip", label: "VIP", description: "บริการพิเศษ", emoji: "★", tone: "from-violet-50 to-white text-violet-700 ring-violet-200" },
  { key: "luggage", label: "สัมภาระ", description: "ขนกระเป๋า", emoji: "▣", tone: "from-cyan-50 to-white text-cyan-700 ring-cyan-200" },
  { key: "shuttle", label: "Shuttle", description: "วนรับส่ง", icon: ShipWheel, tone: "from-lime-50 to-white text-lime-700 ring-lime-200" },
  { key: "airport", label: "Airport", description: "สนามบิน", icon: Plane, tone: "from-blue-50 to-white text-blue-700 ring-blue-200" }
];

// Icons only: the symbol exists to tell units apart on the map, so the tiles
// carry no text. The name stays in the tooltip and for screen readers.
export function VehicleIconPicker({ defaultValue = "van" }: { defaultValue?: VehicleIconKey }) {
  return (
    <div className="flex flex-wrap gap-2">
      {VEHICLE_ICON_OPTIONS.map(({ key, label, description, icon: Icon, emoji, tone }) => (
        <label key={key} className="cursor-pointer" title={`${label} · ${description}`}>
          <input className="peer sr-only" type="radio" name="vehicleIcon" value={key} defaultChecked={key === defaultValue} aria-label={label} />
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-operation/40 hover:shadow-md peer-checked:border-operation peer-checked:bg-operation-soft/70 peer-checked:ring-2 peer-checked:ring-operation/25 peer-focus-visible:ring-2 peer-focus-visible:ring-operation/40">
            <span className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br shadow-inner ring-1 ${tone}`} aria-hidden>
              {Icon ? <Icon className="h-5 w-5" /> : <span className="text-lg font-black leading-none">{emoji}</span>}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
