export interface VehicleUsageCost {
  plannedHours: number | null;
  billableHours: number | null;
  hourlyRate: number | null;
  estimatedCost: number | null;
  source: "assignment_window" | "vehicle_default" | "missing";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function timeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function hoursBetweenTimeOnly(start: unknown, end: unknown): number | null {
  const from = timeToMinutes(start);
  const to = timeToMinutes(end);
  if (from == null || to == null) return null;
  const diff = to >= from ? to - from : to + 24 * 60 - from;
  return Math.round((diff / 60) * 100) / 100;
}

function hoursBetweenIso(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return Math.round(((to - from) / 36e5) * 100) / 100;
}

export function estimateVehicleUsageCost(input: {
  assignmentStart?: string | null;
  assignmentEnd?: string | null;
  vehicleMetadata?: Record<string, unknown> | null;
}): VehicleUsageCost {
  const meta = input.vehicleMetadata ?? {};
  const hourlyRate = numberOrNull(meta.hourlyRate);
  const minimumHours = numberOrNull(meta.minimumHours) ?? 0;
  const assignmentHours = hoursBetweenIso(input.assignmentStart, input.assignmentEnd);
  const defaultHours = hoursBetweenTimeOnly(meta.defaultDutyStart, meta.defaultDutyEnd);
  const plannedHours = assignmentHours ?? defaultHours;
  const billableHours = plannedHours == null ? null : Math.max(plannedHours, minimumHours);

  return {
    plannedHours,
    billableHours,
    hourlyRate,
    estimatedCost: billableHours != null && hourlyRate != null ? Math.round(billableHours * hourlyRate * 100) / 100 : null,
    source: assignmentHours != null ? "assignment_window" : defaultHours != null ? "vehicle_default" : "missing"
  };
}

export function formatVehicleUsageCost(cost: VehicleUsageCost): string {
  if (cost.billableHours == null && cost.hourlyRate == null) return "ยังไม่ระบุเวลาและอัตราค่าจ้าง";
  const parts = [
    cost.billableHours != null ? `${cost.billableHours.toLocaleString("th-TH")} ชม.` : null,
    cost.hourlyRate != null ? `${cost.hourlyRate.toLocaleString("th-TH")} บ./ชม.` : null,
    cost.estimatedCost != null ? `ประมาณ ${cost.estimatedCost.toLocaleString("th-TH")} บ.` : null
  ].filter(Boolean);
  return parts.join(" · ");
}
