import { gpsFreshness } from "@/lib/domain/gps-freshness";

// What the project overview reports. It used to show a "readiness %" computed as
// assignments ÷ missions — jobs per mission, capped at 100 and dressed as a
// percentage, which measured nothing anyone could act on. These are counts of
// things that exist.

export interface ProjectOperationSummary {
  vehicles: number;
  drivers: number;
  /** Active units with both a driver and a vehicle: the ones that can be sent out. */
  crewedUnits: number;
  /** Active units in total. An archived or retired unit is in neither figure. */
  totalUnits: number;
  /** Units whose last GPS fix says the phone is still reporting. */
  reportingPositions: number;
}

export interface OperationSummaryInput {
  vehicles: { id: string }[];
  drivers: { id: string }[];
  callSigns: { status: string; driverId?: string | null; vehicleId?: string | null }[];
  locations: { recordedAt: string; sharingEvent?: string | null; metadata?: unknown }[];
  now: number;
}

export function summariseProjectOperation(input: OperationSummaryInput): ProjectOperationSummary {
  // The same test the dispatch page uses to decide whether a unit may be issued
  // a QR, so the two screens cannot disagree about what "ready" means.
  const active = input.callSigns.filter((callSign) => callSign.status === "active");
  const crewedUnits = active.filter((callSign) => Boolean(callSign.driverId) && Boolean(callSign.vehicleId)).length;

  // `idle` is a phone that is reporting while standing still, which is still
  // reporting. Counting only `live` would put a number on this page that
  // contradicts the map header on the next tab, which has always counted both.
  const reportingPositions = input.locations.filter((location) => {
    const freshness = gpsFreshness(location.recordedAt, location.sharingEvent ?? null, input.now, location.metadata);
    return freshness === "live" || freshness === "idle";
  }).length;

  return {
    vehicles: input.vehicles.length,
    drivers: input.drivers.length,
    crewedUnits,
    totalUnits: active.length,
    reportingPositions
  };
}
