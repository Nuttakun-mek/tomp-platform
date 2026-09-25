export interface VehicleUsageCost {
  plannedHours: number | null;
  countedHours: number | null;
  includedHours: number | null;
  extraHours: number | null;
  billableHours: number | null;
  packageHours: number | null;
  packageAmount: number | null;
  hourlyRate: number | null;
  baseAmount: number | null;
  extraAmount: number | null;
  estimatedCost: number | null;
  source: "actual_session" | "assignment_window" | "vehicle_default" | "missing";
}

export interface VehicleServiceTimeAlert {
  tone: "neutral" | "warning" | "danger" | "success";
  label: string;
  detail: string;
  minutesRemaining: number | null;
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

function laterIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function earlierIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

export function estimateVehicleUsageCost(input: {
  assignmentStart?: string | null;
  assignmentEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  vehicleMetadata?: Record<string, unknown> | null;
}): VehicleUsageCost {
  const meta = input.vehicleMetadata ?? {};
  const packageHours = numberOrNull(meta.packageHours) ?? numberOrNull(meta.minimumHours);
  const packageAmount = numberOrNull(meta.packageAmount);
  const legacyHourlyRate = numberOrNull(meta.hourlyRate);
  const hourlyRate = packageAmount != null && packageHours ? Math.round((packageAmount / packageHours) * 100) / 100 : legacyHourlyRate;
  const includedPackageHours = packageHours ?? 0;
  const assignmentHours = hoursBetweenIso(input.assignmentStart, input.assignmentEnd);
  const effectiveActualStart = laterIso(input.actualStart, input.assignmentStart);
  const effectiveActualEnd = input.actualEnd ? earlierIso(input.actualEnd, null) : null;
  const actualHours = hoursBetweenIso(effectiveActualStart, effectiveActualEnd);
  const defaultHours = hoursBetweenTimeOnly(meta.defaultDutyStart, meta.defaultDutyEnd);
  const plannedHours = assignmentHours ?? defaultHours;
  const countedHours = actualHours ?? plannedHours;
  const includedHours = plannedHours == null ? (includedPackageHours || null) : Math.max(plannedHours, includedPackageHours);
  const billableHours = countedHours == null ? null : Math.max(countedHours, includedHours ?? includedPackageHours);
  const extraHours = billableHours != null && includedHours != null ? Math.max(Math.round((billableHours - includedHours) * 100) / 100, 0) : 0;
  const baseAmount = packageAmount != null && packageHours != null
    ? packageAmount
    : includedHours != null && hourlyRate != null ? Math.round(includedHours * hourlyRate * 100) / 100 : null;
  const extraAmount = extraHours != null && hourlyRate != null ? Math.round(extraHours * hourlyRate * 100) / 100 : null;

  return {
    plannedHours,
    countedHours,
    includedHours,
    extraHours,
    billableHours,
    packageHours: packageHours ?? null,
    packageAmount,
    hourlyRate,
    baseAmount,
    extraAmount,
    estimatedCost: billableHours != null && hourlyRate != null ? Math.round(billableHours * hourlyRate * 100) / 100 : null,
    source: actualHours != null ? "actual_session" : assignmentHours != null ? "assignment_window" : defaultHours != null ? "vehicle_default" : "missing"
  };
}

export function formatVehicleUsageCost(cost: VehicleUsageCost): string {
  if (cost.billableHours == null && cost.hourlyRate == null && cost.packageAmount == null) return "ยังไม่ระบุเวลาและค่าใช้จ่ายในการบริการ";
  const parts = [
    cost.packageHours != null && cost.packageAmount != null ? `ค่าใช้จ่ายในการบริการ ${cost.packageHours.toLocaleString("th-TH")} ชม. ${cost.packageAmount.toLocaleString("th-TH")} บ.` : null,
    cost.billableHours != null ? `ชั่วโมงที่ใช้คำนวณ ${cost.billableHours.toLocaleString("th-TH")} ชม.` : null,
    cost.hourlyRate != null ? `อัตราเฉลี่ย ${cost.hourlyRate.toLocaleString("th-TH")} บ./ชม.` : null,
    cost.estimatedCost != null ? `ประมาณ ${cost.estimatedCost.toLocaleString("th-TH")} บ.` : null
  ].filter(Boolean);
  return parts.join(" · ");
}

export function vehicleUsageCostBreakdown(cost: VehicleUsageCost): string {
  if (cost.billableHours == null || cost.hourlyRate == null || cost.estimatedCost == null) {
    return formatVehicleUsageCost(cost);
  }
  // "No overtime" is only a finding once the real clock-in and clock-out are
  // known. Before that the hours are the plan's, so say so instead of implying
  // the job finished on time.
  const extra = cost.extraHours && cost.extraHours > 0
    ? `มีค่าล่วงเวลา (OT) ${cost.extraHours.toLocaleString("th-TH")} ชม.`
    : cost.source === "actual_session"
      ? "ไม่เกินเวลาที่กำหนด"
      : "ประมาณการตามเวลาในแผน (ยังไม่มีเวลาออกจริง)";
  const base = cost.packageHours != null && cost.packageAmount != null
    ? `ค่าใช้จ่ายในการบริการ ${cost.packageHours.toLocaleString("th-TH")} ชม. ${cost.packageAmount.toLocaleString("th-TH")} บ.`
    : `${cost.billableHours.toLocaleString("th-TH")} ชม. × ${cost.hourlyRate.toLocaleString("th-TH")} บ./ชม.`;
  return `${base} = ${cost.estimatedCost.toLocaleString("th-TH")} บ. · ${extra}`;
}

export function evaluateVehicleServiceTimeAlert(input: {
  /** Planned start. With it, the warning comes at 80% of the planned window. */
  assignmentStart?: string | null;
  assignmentEnd?: string | null;
  workSessionStatus?: "pending" | "active" | "ended" | string | null;
  actualEnd?: string | null;
  extraHours?: number | null;
  /** The job itself is finished (driver or control room marked it done). */
  jobCompleted?: boolean;
  now?: number;
  /** Used only when the planned start is unknown. */
  warnBeforeMinutes?: number;
}): VehicleServiceTimeAlert {
  const extraHours = input.extraHours ?? 0;
  if (input.workSessionStatus === "ended") {
    if (extraHours > 0) {
      return {
        tone: "danger",
        label: "มีค่าล่วงเวลา",
        detail: `เกินเวลาบริการ ${extraHours.toLocaleString("th-TH")} ชม.`,
        minutesRemaining: null
      };
    }
    return { tone: "success", label: "ปิดเวลาบริการแล้ว", detail: "ไม่เกินเวลาที่กำหนด", minutesRemaining: null };
  }

  if (input.workSessionStatus !== "active") {
    return { tone: "neutral", label: "ยังไม่เริ่มเวลาบริการ", detail: "รอคนขับบันทึกเวลาเข้า", minutesRemaining: null };
  }

  // Done, but still on the clock: the real end time is unknown, so overtime
  // cannot be judged yet. The action for the control room is the clock-out.
  if (input.jobCompleted) {
    return {
      tone: "warning",
      label: "ยังไม่บันทึกเวลาออก",
      detail: "งานเสร็จแล้วแต่คนขับยังไม่บันทึกเวลาออก ค่าใช้จ่ายคิดตามเวลาในแผนไปก่อน",
      minutesRemaining: null
    };
  }

  if (!input.assignmentEnd) {
    return { tone: "neutral", label: "ยังไม่ระบุเวลาสิ้นสุด", detail: "ไม่สามารถประเมินค่าล่วงเวลาได้", minutesRemaining: null };
  }

  const end = new Date(input.assignmentEnd).getTime();
  const now = input.now ?? Date.now();
  if (!Number.isFinite(end)) {
    return { tone: "neutral", label: "เวลาสิ้นสุดไม่ถูกต้อง", detail: "ไม่สามารถประเมินค่าล่วงเวลาได้", minutesRemaining: null };
  }

  const minutesRemaining = Math.ceil((end - now) / 60000);
  // Amber from 80% of the planned window (981 Wave 2): it exists so the control
  // room can call the driver while there is still time, and a fixed 30 minutes
  // is too late on a full-day job. Without a start time, fall back to that.
  const start = input.assignmentStart ? new Date(input.assignmentStart).getTime() : Number.NaN;
  const warnBeforeMinutes =
    Number.isFinite(start) && start < end ? Math.floor(((end - start) / 60000) * 0.2) : (input.warnBeforeMinutes ?? 30);
  if (minutesRemaining < 0) {
    return {
      tone: "danger",
      label: "เกินเวลาบริการ",
      detail: `เกินเวลาที่กำหนด ${Math.abs(minutesRemaining).toLocaleString("th-TH")} นาที`,
      minutesRemaining
    };
  }
  if (minutesRemaining <= warnBeforeMinutes) {
    return {
      tone: "warning",
      label: "ใกล้ครบเวลาบริการ",
      detail: `เหลือ ${minutesRemaining.toLocaleString("th-TH")} นาที ก่อนเริ่มคิดค่าล่วงเวลา`,
      minutesRemaining
    };
  }
  return {
    tone: "success",
    label: "อยู่ในเวลาบริการ",
    detail: `เหลือ ${minutesRemaining.toLocaleString("th-TH")} นาที`,
    minutesRemaining
  };
}
