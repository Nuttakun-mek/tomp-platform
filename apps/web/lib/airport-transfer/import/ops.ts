import { suggestedPickupAt, type FlightOption } from "./flight-match";

// The operational half of an import row — what the control room adds before a
// case exists: when to pick up, where to meet at the airport, which unit goes.
// None of it is required (a case without a unit waits as "รอจัดรถ"); what it
// can say is warned about, never blocked.

export interface RowOps {
  /** ISO. Empty means the suggested time (landing + 45 min / take-off − 3 h). */
  pickupAt?: string | null;
  /** Where to meet at the airport end, e.g. "ประตู 3 ชั้น 2". */
  meetingPoint?: string | null;
  /** A Ground Transfer unit of this project; fills the vehicle and driver. */
  callSignId?: string | null;
  /** Typed by hand when the vehicle is not one of the project's units. */
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
}

export interface UnitOption {
  id: string;
  label: string;
  plate: string | null;
  vehicleType: string | null;
  capacity: number | null;
  driverName: string | null;
  driverPhone: string | null;
}

export interface OpsRowInput {
  id: string;
  direction: "arrival" | "departure" | null;
  passengerCount: number | null;
  flight?: FlightOption | null;
  ops?: RowOps | null;
}

/** Two pickups by one unit closer than this cannot both be served. */
export const UNIT_GAP_MIN = 60;

export function effectivePickupAt(row: Pick<OpsRowInput, "direction" | "flight" | "ops">): string | null {
  if (row.ops?.pickupAt) return row.ops.pickupAt;
  return row.direction && row.flight ? suggestedPickupAt(row.direction, row.flight) : null;
}

export function opsWarnings(rows: OpsRowInput[], units: UnitOption[]): Map<string, string[]> {
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const out = new Map<string, string[]>();
  const add = (id: string, text: string) => out.set(id, [...(out.get(id) ?? []), text]);

  const byUnit = new Map<string, Array<{ id: string; at: number }>>();
  for (const row of rows) {
    const unitId = row.ops?.callSignId;
    if (!unitId) continue;
    const unit = unitById.get(unitId);
    if (unit?.capacity && row.passengerCount && row.passengerCount > unit.capacity) {
      add(row.id, `ผู้โดยสาร ${row.passengerCount} คน เกินที่นั่งของ ${unit.label} (${unit.capacity})`);
    }
    const at = Date.parse(effectivePickupAt(row) ?? "");
    if (Number.isFinite(at)) byUnit.set(unitId, [...(byUnit.get(unitId) ?? []), { id: row.id, at }]);
  }
  for (const [unitId, pickups] of byUnit) {
    const sorted = pickups.sort((a, b) => a.at - b.at);
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = (sorted[i].at - sorted[i - 1].at) / 60_000;
      if (gap < UNIT_GAP_MIN) {
        const label = unitById.get(unitId)?.label ?? "รถคันนี้";
        const text = `${label} มีเวลารับห่างกันเพียง ${Math.round(gap)} นาที`;
        add(sorted[i - 1].id, text);
        add(sorted[i].id, text);
      }
    }
  }
  return out;
}
