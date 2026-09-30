import type { DutyDayCost, DutyStatus } from "./duty-hours";
import { gpsFreshness } from "./gps-freshness";

// What the control room should be told before it has to go looking: a vehicle
// not moving when its job is about to start, a phone that went quiet mid-job,
// and overtime about to start or already running. Pure — the page supplies the
// data it already polls, and decides how loudly to say it.

export const ALERT_THRESHOLDS = {
  /** Warn this long before a job starts if the driver has not set off. */
  notMovingBeforeStartMin: 15,
  /** A job this late with no movement is still worth a word, for up to an hour. */
  notMovingAfterStartMin: 60,
  /** GPS silent this long during a job, and past the app's own freshness limits. */
  gpsSilentMin: 5,
  /** Warn this long before the scheduled clock-out (see duty-hours.ts DUTY_END_WARNING_MIN). */
  overtimeSoonMin: 15
} as const;

export type AlertKind = "not_moving" | "gps_silent" | "overtime_soon" | "overtime";

export interface ControlAlert {
  /** Stable per job and kind, so an alert fires once. */
  id: string;
  kind: AlertKind;
  assignmentId: string;
  severity: "warning" | "danger";
  title: string;
  detail: string;
}

export interface AlertJob {
  id: string;
  label: string;
  status: string;
  startTime?: string | null;
  endTime?: string | null;
}

/** One unit's day, already worked out by duty-hours.ts unitDutyDay. */
export interface AlertUnitDay {
  unitId: string;
  label: string;
  /** A job of the unit, so the alert can open its chat. */
  assignmentId: string;
  day: { cost: DutyDayCost; status: DutyStatus };
}

export interface AlertInputs {
  jobs: AlertJob[];
  /** Latest driver-reported status per job. */
  reported: Record<string, { status: string } | undefined>;
  /** Clock-in state per job (already carried across a driver's shift). */
  sessions: Record<string, { status: string; startedAt: string | null; endedAt: string | null } | undefined>;
  /** Latest position per job. */
  locations: Record<string, { recordedAt: string; sharingEvent?: string | null; metadata?: unknown } | undefined>;
  /** Overtime is the unit's, measured against its scheduled clock-out — not any sub-job's end. */
  units?: AlertUnitDay[];
  now: number;
}

const ON_THE_WAY = new Set(["arrived_pickup", "passenger_onboard", "completed", "active"]);
const CLOSED = new Set(["completed", "cancelled", "archived"]);
const IN_PROGRESS = new Set(["active", "arrived_pickup", "passenger_onboard"]);

const minutes = (ms: number) => Math.round(ms / 60_000);

export function computeControlAlerts({ jobs, reported, sessions, locations, units = [], now }: AlertInputs): ControlAlert[] {
  const out: ControlAlert[] = [];
  for (const job of jobs) {
    if (CLOSED.has(job.status)) continue;
    const report = reported[job.id]?.status;
    if (report === "completed") continue;
    const start = job.startTime ? Date.parse(job.startTime) : Number.NaN;
    const session = sessions[job.id];
    const inProgress = IN_PROGRESS.has(job.status) || (report ? IN_PROGRESS.has(report) : false);

    // 1. About to start (or already late) and nobody has set off.
    if (Number.isFinite(start) && !inProgress && !(report && ON_THE_WAY.has(report))) {
      const untilStart = start - now;
      if (untilStart <= ALERT_THRESHOLDS.notMovingBeforeStartMin * 60_000 && untilStart >= -ALERT_THRESHOLDS.notMovingAfterStartMin * 60_000) {
        const late = untilStart < 0;
        out.push({
          id: `not_moving:${job.id}`,
          kind: "not_moving",
          assignmentId: job.id,
          severity: late ? "danger" : "warning",
          title: late ? `${job.label} เลยเวลาเริ่มงานแล้ว` : `${job.label} ใกล้เวลาเริ่มงาน`,
          detail: late
            ? `เลยมา ${minutes(-untilStart)} นาที ยังไม่มีสถานะออกรถจากคนขับ`
            : `อีก ${minutes(untilStart)} นาที ยังไม่มีสถานะออกรถจากคนขับ${session?.status === "active" ? "" : " และยังไม่บันทึกเวลาเข้า"}`
        });
      }
    }

    // 2. On a job, and the phone has gone quiet.
    if (inProgress) {
      const location = locations[job.id];
      const age = location ? now - Date.parse(location.recordedAt) : Number.POSITIVE_INFINITY;
      const freshness = location ? gpsFreshness(location.recordedAt, location.sharingEvent, now, location.metadata) : "offline";
      if ((freshness === "offline" || freshness === "stopped") && age >= ALERT_THRESHOLDS.gpsSilentMin * 60_000) {
        out.push({
          id: `gps_silent:${job.id}`,
          kind: "gps_silent",
          assignmentId: job.id,
          severity: "danger",
          title: `${job.label} ไม่มีสัญญาณ GPS`,
          detail: location
            ? freshness === "stopped"
              ? "คนขับหยุดแชร์ตำแหน่งระหว่างงาน"
              : `ตำแหน่งล่าสุดเมื่อ ${minutes(age)} นาทีที่แล้ว`
            : "ยังไม่เคยได้รับตำแหน่งจากงานนี้"
        });
      }
    }
  }

  // 3. Overtime, per unit: the scheduled clock-out is close, or has passed with
  // the driver still clocked in. Clocking in early is never overtime.
  for (const unit of units) {
    const { cost, status } = unit.day;
    if (cost.state === "overtime") {
      out.push({ id: `overtime:${unit.unitId}:${cost.dutyEnd}`, kind: "overtime", assignmentId: unit.assignmentId, severity: "danger", title: `${unit.label} เข้า OT แล้ว`, detail: status.detail });
    } else if (cost.state === "on_duty" && status.tone === "warning") {
      out.push({ id: `overtime_soon:${unit.unitId}:${cost.dutyEnd}`, kind: "overtime_soon", assignmentId: unit.assignmentId, severity: "warning", title: `${unit.label} ${status.label}`, detail: status.detail });
    }
  }
  return out;
}
