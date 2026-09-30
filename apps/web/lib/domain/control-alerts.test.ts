import { describe, expect, it } from "vitest";
import { computeControlAlerts, type AlertInputs, type AlertJob } from "./control-alerts";

const NOW = Date.parse("2026-10-02T03:00:00Z"); // 10:00 Bangkok
const at = (minutesFromNow: number) => new Date(NOW + minutesFromNow * 60_000).toISOString();
const job = (over: Partial<AlertJob> = {}): AlertJob => ({ id: "j1", label: "CS-01", status: "planned", startTime: at(10), endTime: at(250), ...over });
const run = (over: Partial<AlertInputs>) => computeControlAlerts({ jobs: [job()], reported: {}, sessions: {}, locations: {}, now: NOW, ...over });

describe("computeControlAlerts", () => {
  it("warns when a job starts within 15 minutes and nobody has set off", () => {
    const alerts = run({});
    expect(alerts.map((a) => a.kind)).toEqual(["not_moving"]);
    expect(alerts[0].severity).toBe("warning");
  });

  it("stays quiet once the driver reports being on the way, or when the start is far off", () => {
    // (A job that reports progress but has never sent a position still gets the GPS alert.)
    expect(run({ reported: { j1: { status: "arrived_pickup" } }, locations: { j1: { recordedAt: at(0) } } })).toEqual([]);
    expect(run({ jobs: [job({ startTime: at(60) })] })).toEqual([]);
  });

  it("escalates when the start has passed", () => {
    const [alert] = run({ jobs: [job({ startTime: at(-20) })] });
    expect(alert.severity).toBe("danger");
    expect(alert.detail).toContain("20 นาที");
  });

  it("flags a quiet phone on a running job, but not a parked phone on its 2-minute heartbeat", () => {
    const active = job({ status: "active", startTime: at(-60) });
    expect(run({ jobs: [active], locations: { j1: { recordedAt: at(-12) } } }).map((a) => a.kind)).toContain("gps_silent");
    expect(run({ jobs: [active], locations: { j1: { recordedAt: at(-2) } } }).map((a) => a.kind)).not.toContain("gps_silent");
  });

  it("never calls the end of a sub-job overtime — only the unit's scheduled clock-out", () => {
    // Driver on duty 07:00–17:00, the sub-job ended an hour ago, still clocked in.
    const onClock = { j1: { status: "active", startedAt: at(-420), endedAt: null } };
    const alerts = run({ jobs: [job({ status: "active", startTime: at(-120), endTime: at(-60) })], sessions: onClock, locations: { j1: { recordedAt: at(0) } } });
    expect(alerts.map((a) => a.kind)).not.toContain("overtime");
  });

  it("warns before the scheduled clock-out and flags running overtime, per unit", () => {
    const window = { start: at(-600), end: at(10) };
    const day = (state: "on_duty" | "overtime", tone: "warning" | "danger") => ({
      cost: { state, dutyStart: window.start, dutyEnd: window.end } as never,
      status: { tone, label: "ใกล้เวลาออกงาน 17:00", detail: "…" }
    });
    const soon = run({ jobs: [], units: [{ unitId: "cs1", label: "CS-01", assignmentId: "j1", day: day("on_duty", "warning") }] });
    expect(soon.map((a) => a.kind)).toEqual(["overtime_soon"]);
    const over = run({ jobs: [], units: [{ unitId: "cs1", label: "CS-01", assignmentId: "j1", day: day("overtime", "danger") }] });
    expect(over.map((a) => [a.kind, a.severity])).toEqual([["overtime", "danger"]]);
  });

  it("ignores finished work", () => {
    expect(run({ jobs: [job({ status: "completed" })] })).toEqual([]);
    expect(run({ reported: { j1: { status: "completed" } } })).toEqual([]);
  });
});
