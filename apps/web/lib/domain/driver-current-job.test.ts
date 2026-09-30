import { describe, expect, it } from "vitest";
import { isLaterDayJob, pickCurrentJob, type UnitJobRow } from "./driver-current-job";

// Van-01 on 30 Sep 2026 (Bangkok): two jobs tonight, two tomorrow morning.
const job = (id: string, status: string, startBkk: string): UnitJobRow => ({
  id,
  status,
  startTime: new Date(`${startBkk}:00+07:00`).toISOString(),
  createdAt: "2026-09-30T00:00:00Z"
});
const at = (bkk: string) => new Date(`${bkk}:00+07:00`);

describe("pickCurrentJob", () => {
  it("stays on today's finished work instead of jumping to tomorrow's first job", () => {
    const jobs = [
      job("tonight-1", "completed", "2026-09-30T18:00"),
      job("tonight-2", "completed", "2026-09-30T19:00"),
      job("tomorrow-1", "planned", "2026-10-01T08:00"),
      job("tomorrow-2", "planned", "2026-10-01T09:00")
    ];
    expect(pickCurrentJob(jobs, at("2026-09-30T21:30"))?.id).toBe("tonight-2");
  });

  it("moves to the new day's first job once that day begins", () => {
    const jobs = [
      job("tonight-2", "completed", "2026-09-30T19:00"),
      job("tomorrow-2", "planned", "2026-10-01T09:00"),
      job("tomorrow-1", "planned", "2026-10-01T08:00")
    ];
    expect(pickCurrentJob(jobs, at("2026-10-01T06:00"))?.id).toBe("tomorrow-1");
  });

  it("takes today's next job over today's finished one", () => {
    const jobs = [job("done", "completed", "2026-09-30T18:00"), job("next", "planned", "2026-09-30T19:00")];
    expect(pickCurrentJob(jobs, at("2026-09-30T19:05"))?.id).toBe("next");
  });

  it("keeps a job under way even after midnight", () => {
    const jobs = [job("late", "active", "2026-09-30T23:00"), job("tomorrow", "planned", "2026-10-01T08:00")];
    expect(pickCurrentJob(jobs, at("2026-10-01T00:30"))?.id).toBe("late");
  });

  it("puts a job the driver started ahead of an earlier one not started", () => {
    const jobs = [job("earlier", "planned", "2026-09-30T08:00"), job("urgent", "acknowledged", "2026-09-30T10:00")];
    expect(pickCurrentJob(jobs, at("2026-09-30T07:00"))?.id).toBe("urgent");
  });

  it("with nothing today, points at the next working day", () => {
    const jobs = [job("old", "completed", "2026-09-28T08:00"), job("friday", "planned", "2026-10-02T08:00")];
    const picked = pickCurrentJob(jobs, at("2026-09-30T12:00"));
    expect(picked?.id).toBe("friday");
    expect(isLaterDayJob(picked!, at("2026-09-30T12:00"))).toBe(true);
    expect(isLaterDayJob(picked!, at("2026-10-02T05:00"))).toBe(false);
  });

  it("ignores cancelled jobs", () => {
    expect(pickCurrentJob([job("x", "cancelled", "2026-09-30T08:00")], at("2026-09-30T07:00"))).toBeNull();
  });
});
