export type VehicleIconKey = "sedan" | "suv" | "van" | "minibus" | "bus" | "pickup" | "truck" | "motorcycle";

const VALID: VehicleIconKey[] = ["sedan", "suv", "van", "minibus", "bus", "pickup", "truck", "motorcycle"];

export function normaliseVehicleIcon(value: unknown): VehicleIconKey | null {
  return typeof value === "string" && (VALID as string[]).includes(value) ? (value as VehicleIconKey) : null;
}

export function inferVehicleIcon(input: { icon?: unknown; vehicleType?: string | null; capacity?: number | null }): VehicleIconKey {
  const explicit = normaliseVehicleIcon(input.icon);
  if (explicit) return explicit;

  const type = String(input.vehicleType || "").toLowerCase();
  if (type.includes("bus") || type.includes("บัส")) return "bus";
  if (type.includes("mini")) return "minibus";
  if (type.includes("van") || type.includes("ตู้")) return "van";
  if (type.includes("truck") || type.includes("บรรทุก")) return "truck";
  if (type.includes("pickup") || type.includes("กระบะ")) return "pickup";
  if (type.includes("motor") || type.includes("bike") || type.includes("มอเตอร์")) return "motorcycle";
  if (type.includes("suv")) return "suv";

  const capacity = Number(input.capacity || 0);
  if (capacity >= 30) return "bus";
  if (capacity >= 13) return "minibus";
  if (capacity >= 7) return "van";
  if (capacity <= 2 && capacity > 0) return "motorcycle";
  return "sedan";
}

export function vehicleIconLabel(key: VehicleIconKey): string {
  const labels: Record<VehicleIconKey, string> = {
    sedan: "เก๋ง",
    suv: "SUV",
    van: "รถตู้",
    minibus: "มินิบัส",
    bus: "รถบัส",
    pickup: "กระบะ",
    truck: "บรรทุก",
    motorcycle: "มอเตอร์ไซค์"
  };
  return labels[key];
}

export function vehicleIconShortLabel(key: VehicleIconKey): string {
  const labels: Record<VehicleIconKey, string> = {
    sedan: "เก๋ง",
    suv: "SUV",
    van: "ตู้",
    minibus: "มินิ",
    bus: "บัส",
    pickup: "กระ",
    truck: "บรร",
    motorcycle: "MC"
  };
  return labels[key];
}
