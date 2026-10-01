import { describe, expect, it } from "vitest";
import { buildDutySchedule, dutyDayCost, dutyWindow, readDutyAdjustment, readDutySchedule, resolveDutyWindow, unitDutyDay } from "./duty-hours";

const bkk = (date: string, clock: string) => new Date(`${date}T${clock}:00+07:00`).toISOString();
const DAY = "2026-10-02";
const window = dutyWindow(DAY, { start: "07:00", end: "17:00" });
const van = { packageHours: 10, packageAmount: 3000 };

describe("dutyWindow", () => {
  it("is Bangkok time, and an end at or before the start is the next morning", () => {
    expect(window).toEqual({ start: bkk(DAY, "07:00"), end: bkk(DAY, "17:00") });
    expect(dutyWindow(DAY, { start: "18:00", end: "02:00" }).end).toBe(bkk("2026-10-03", "02:00"));
  });
});

describe("dutyDayCost — owner's rules", () => {
  it("clocking in early is not overtime; clocking out on time is none", () => {
    const cost = dutyDayCost({ window, source: "duty_hours", clockIn: bkk(DAY, "06:30"), clockOut: bkk(DAY, "17:00"), vehicleMetadata: van });
    expect(cost.overtimeHours).toBe(0);
    expect(cost.total).toBe(3000);
    expect(cost.state).toBe("done");
  });

  it("every minute after the scheduled clock-out is overtime, at the package rate", () => {
    const cost = dutyDayCost({ window, source: "duty_hours", clockIn: bkk(DAY, "07:00"), clockOut: bkk(DAY, "18:30"), vehicleMetadata: van });
    expect(cost.overtimeHours).toBe(1.5);
    expect(cost.overtimeAmount).toBe(450);
    expect(cost.total).toBe(3450);
  });

  it("sub-job times play no part: jobs ending mid-afternoon with the driver on duty is not overtime", () => {
    const cost = dutyDayCost({ window, source: "duty_hours", clockIn: bkk(DAY, "07:00"), clockOut: null, now: Date.parse(bkk(DAY, "14:01")), vehicleMetadata: van });
    expect(cost.state).toBe("on_duty");
    expect(cost.overtimeHours).toBe(0);
  });

  it("a driver still clocked in after the scheduled end is running overtime, counted to now", () => {
    const cost = dutyDayCost({ window, source: "duty_hours", clockIn: bkk(DAY, "07:00"), clockOut: null, now: Date.parse(bkk(DAY, "17:45")), vehicleMetadata: van });
    expect(cost.state).toBe("overtime");
    expect(cost.overtimeHours).toBe(0.75);
  });

  it("a longer duty day than the package is paid by the hour at the package rate", () => {
    const long = dutyWindow(DAY, { start: "07:00", end: "19:00" });
    expect(dutyDayCost({ window: long, source: "duty_hours", clockIn: bkk(DAY, "07:00"), clockOut: bkk(DAY, "19:00"), vehicleMetadata: van }).total).toBe(3600);
  });

  it("no clock-in, no overtime; no rate, no money", () => {
    expect(dutyDayCost({ window, source: "duty_hours", clockIn: null, clockOut: null, vehicleMetadata: van }).state).toBe("not_started");
    expect(dutyDayCost({ window, source: "duty_hours", clockIn: bkk(DAY, "07:00"), clockOut: bkk(DAY, "18:00"), vehicleMetadata: {} }).total).toBeNull();
  });
});

describe("schedules", () => {
  it("builds one entry per day with per-day overrides, and reads back only valid entries", () => {
    const schedule = buildDutySchedule("2026-10-01", "2026-10-03", { start: "07:00", end: "17:00" }, { "2026-10-02": { start: "10:00", end: "22:00" } });
    expect(Object.keys(schedule)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(schedule["2026-10-02"].end).toBe("22:00");
    expect(readDutySchedule({ dutyHours: { ...schedule, bad: { start: "7", end: "x" } } })).toEqual(schedule);
  });

  it("falls back to the day's sub-jobs when no duty hours were set", () => {
    const resolved = resolveDutyWindow(DAY, {}, [
      { startTime: bkk(DAY, "13:00"), endTime: bkk(DAY, "14:00") },
      { startTime: bkk(DAY, "14:00"), endTime: bkk(DAY, "15:00") }
    ]);
    expect(resolved).toEqual({ window: { start: bkk(DAY, "13:00"), end: bkk(DAY, "15:00") }, source: "sub_jobs" });
  });
});

describe("unitDutyDay", () => {
  const schedule = { [DAY]: { start: "07:00", end: "17:00" } };
  const jobs = [{ startTime: bkk(DAY, "13:00"), endTime: bkk(DAY, "14:00") }, { startTime: bkk(DAY, "14:00"), endTime: bkk(DAY, "15:00") }];

  it("reads 'in working hours' at 14:01 between two back-to-back sub-jobs", () => {
    const day = unitDutyDay({ date: DAY, schedule, jobs, session: { startedAt: bkk(DAY, "06:50"), endedAt: null }, now: Date.parse(bkk(DAY, "14:01")), vehicleMetadata: van })!;
    expect(day.status.tone).toBe("success");
    expect(day.cost.overtimeHours).toBe(0);
  });

  it("warns 15 minutes before the scheduled clock-out, then shows running OT", () => {
    const at = (clock: string) => unitDutyDay({ date: DAY, schedule, jobs, session: { startedAt: bkk(DAY, "07:00"), endedAt: null }, now: Date.parse(bkk(DAY, clock)), vehicleMetadata: van })!;
    expect(at("16:50").status.tone).toBe("warning");
    expect(at("17:30").status).toMatchObject({ tone: "danger", label: "OT 0.5 ชม." });
  });

  it("ignores a shift from another day", () => {
    const day = unitDutyDay({ date: DAY, schedule, jobs, session: { startedAt: bkk("2026-09-30", "07:00"), endedAt: null }, now: Date.parse(bkk(DAY, "08:00")), vehicleMetadata: van })!;
    expect(day.cost.state).toBe("not_started");
  });
});

describe("late clock-in and the control room's corrections (2026-10-01)", () => {
  const day = dutyWindow(DAY, { start: "08:00", end: "18:00" });
  const cost = (clockIn: string, clockOut: string | null, adjustment?: Parameters<typeof dutyDayCost>[0]["adjustment"]) =>
    dutyDayCost({ window: day, source: "duty_hours", clockIn: bkk(DAY, clockIn), clockOut: clockOut ? bkk(DAY, clockOut) : null, vehicleMetadata: van, adjustment });

  it("moves the end out by the lateness, so a late driver still works the full day before overtime", () => {
    const late = cost("08:30", "18:40");
    expect(late.dutyEnd).toBe(bkk(DAY, "18:30"));
    expect(late.endBasis).toBe("late_start");
    expect(late.scheduledEnd).toBe(bkk(DAY, "18:00"));
    expect(late.overtimeHours).toBe(0.17);
  });

  it("keeps the scheduled end for an early clock-in", () => {
    const early = cost("07:40", "18:30");
    expect(early.dutyEnd).toBe(bkk(DAY, "18:00"));
    expect(early.endBasis).toBe("scheduled");
    expect(early.overtimeHours).toBe(0.5);
  });

  it("uses the control room's end and clock-out over the computed ones", () => {
    const adjusted = cost("08:30", null, { endAt: bkk(DAY, "19:00"), clockOutAt: bkk(DAY, "20:00") });
    expect(adjusted.dutyEnd).toBe(bkk(DAY, "19:00"));
    expect(adjusted.computedEnd).toBe(bkk(DAY, "18:30"));
    expect(adjusted.endBasis).toBe("adjusted");
    expect(adjusted.clockOut).toBe(bkk(DAY, "20:00"));
    expect(adjusted.clockOutAdjusted).toBe(true);
    expect(adjusted.recordedClockOut).toBeNull();
    expect(adjusted.state).toBe("done");
    expect(adjusted.overtimeHours).toBe(1);
  });

  it("reads a unit's correction for a day, and nothing when it was cleared", () => {
    const metadata = {
      dutyAdjustments: {
        [DAY]: { "cs-1": { endAt: bkk(DAY, "19:00"), clockOutAt: null, reason: "ลูกค้าขอต่อเวลา" }, "cs-2": { endAt: null, clockOutAt: null } }
      }
    };
    expect(readDutyAdjustment(metadata, DAY, "cs-1")?.endAt).toBe(bkk(DAY, "19:00"));
    expect(readDutyAdjustment(metadata, DAY, "cs-2")).toBeNull();
    expect(readDutyAdjustment(metadata, "2026-10-03", "cs-1")).toBeNull();
  });

  it("warns ahead of the moved end, not the scheduled one", () => {
    const result = unitDutyDay({
      date: DAY,
      schedule: { [DAY]: { start: "08:00", end: "18:00" } },
      jobs: [],
      session: { startedAt: bkk(DAY, "08:30"), endedAt: null },
      now: Date.parse(bkk(DAY, "18:05")),
      vehicleMetadata: van
    });
    expect(result?.cost.state).toBe("on_duty");
    expect(result?.status.label).toContain("18:30");
  });
});
