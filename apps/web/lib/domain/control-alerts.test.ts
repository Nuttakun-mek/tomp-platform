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

  it("warns 15 minutes before overtime and prices it once it runs", () => {
    const onClock = { j1: { status: "active", startedAt: at(-600), endedAt: null } };
    const soon = run({ jobs: [job({ status: "active", startTime: at(-590), endTime: at(10) })], sessions: onClock, locations: { j1: { recordedAt: at(0) } } });
    expect(soon.map((a) => a.kind)).toEqual(["overtime_soon"]);

    const over = run({
      jobs: [job({ status: "active", startTime: at(-600), endTime: at(-60), vehicleMetadata: { packageHours: 9, packageAmount: 2700 } })],
      sessions: onClock,
      locations: { j1: { recordedAt: at(0) } }
    });
    const overtime = over.find((a) => a.kind === "overtime")!;
    expect(overtime.detail).toContain("OT 1 ชม.");
    expect(overtime.detail).toContain("300 บ.");
  });

  it("ignores finished work", () => {
    expect(run({ jobs: [job({ status: "completed" })] })).toEqual([]);
    expect(run({ reported: { j1: { status: "completed" } } })).toEqual([]);
  });
});
