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

export function vehicleIconSvgMarkup(key: VehicleIconKey): string {
  const bodies: Record<VehicleIconKey, string> = {
    sedan: '<path d="M5 12l1.6-3.2A3 3 0 0 1 9.3 7h5.4a3 3 0 0 1 2.7 1.8L19 12"/><path d="M4 12h16v5H4z"/><path d="M7 17v1.5M17 17v1.5"/><circle cx="8" cy="17" r="1.4"/><circle cx="16" cy="17" r="1.4"/>',
    suv: '<path d="M4 12l1.4-3.5A3 3 0 0 1 8.2 7H15a4 4 0 0 1 3.2 1.6L20 11v6H4z"/><path d="M8 7v5M15 7v5M4 12h16"/><circle cx="8" cy="17" r="1.4"/><circle cx="17" cy="17" r="1.4"/>',
    van: '<path d="M4 8h11l5 4v5H4z"/><path d="M8 8v9M15 8v9M15 12h5"/><circle cx="8" cy="17" r="1.4"/><circle cx="17" cy="17" r="1.4"/>',
    minibus: '<path d="M3.5 7.5h17v9.5h-17z"/><path d="M7 7.5v5M10.5 7.5v5M14 7.5v5M17.5 7.5v5"/><path d="M5 13h14"/><circle cx="7.5" cy="17" r="1.3"/><circle cx="16.5" cy="17" r="1.3"/>',
    bus: '<path d="M4 5.5h16v12H4z"/><path d="M4 10.5h16M8 5.5v5M12 5.5v5M16 5.5v5"/><circle cx="7.5" cy="17.5" r="1.3"/><circle cx="16.5" cy="17.5" r="1.3"/>',
    pickup: '<path d="M4 10h9v7H4z"/><path d="M13 12h4.8L20 14.5V17h-7z"/><path d="M6.5 10l1-2h3l1.5 2"/><circle cx="7.5" cy="17" r="1.4"/><circle cx="17" cy="17" r="1.4"/>',
    truck: '<path d="M3.5 8h10v9h-10z"/><path d="M13.5 11h4.5l2.5 3v3h-7z"/><path d="M5.5 10.5h5.5"/><circle cx="7" cy="17" r="1.4"/><circle cx="17.5" cy="17" r="1.4"/>',
    motorcycle: '<path d="M7 16l3-5h3l3 5"/><path d="M11 11l2-3h2"/><path d="M10 11h-2"/><circle cx="6" cy="16" r="2.2"/><circle cx="18" cy="16" r="2.2"/>'
  };
  return `<svg class="tomp-map-marker-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${bodies[key]}</svg>`;
}
