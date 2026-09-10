import { describe, expect, it } from "vitest";
import { latestEvidenceByDriver } from "./driver-evidence";

const entry = (assignmentId: string, driverId: string | null, at: string) => ({ assignmentId, driverId, at });

describe("latestEvidenceByDriver", () => {
  it("finds a driver's photo even when it was taken on a different job", () => {
    // The regression: the control room showed the photo only against the first
    // job the driver opened, and nothing on the rest of their day.
    const byDriver = latestEvidenceByDriver({
      "job-1": entry("job-1", "driver-a", "2026-09-10T08:00:00Z")
    });
    expect(byDriver.get("driver-a")?.assignmentId).toBe("job-1");
  });

  it("keeps the newest check-in when a driver checked in more than once", () => {
    const byDriver = latestEvidenceByDriver({
      "job-1": entry("job-1", "driver-a", "2026-09-10T08:00:00Z"),
      "job-2": entry("job-2", "driver-a", "2026-09-10T13:30:00Z"),
      "job-3": entry("job-3", "driver-a", "2026-09-10T11:00:00Z")
    });
    expect(byDriver.get("driver-a")?.assignmentId).toBe("job-2");
  });

  it("keeps drivers apart", () => {
    const byDriver = latestEvidenceByDriver({
      "job-1": entry("job-1", "driver-a", "2026-09-10T08:00:00Z"),
      "job-2": entry("job-2", "driver-b", "2026-09-10T09:00:00Z")
    });
    expect(byDriver.get("driver-a")?.assignmentId).toBe("job-1");
    expect(byDriver.get("driver-b")?.assignmentId).toBe("job-2");
    expect(byDriver.size).toBe(2);
  });

  it("skips check-ins with no driver — that work is still shown on its own job", () => {
    const byDriver = latestEvidenceByDriver({
      "job-1": entry("job-1", null, "2026-09-10T08:00:00Z"),
      "job-2": entry("job-2", undefined as unknown as null, "2026-09-10T08:00:00Z")
    });
    expect(byDriver.size).toBe(0);
  });

  it("does not let an unreadable timestamp win over a real one", () => {
    const byDriver = latestEvidenceByDriver({
      "job-1": entry("job-1", "driver-a", "2026-09-10T08:00:00Z"),
      "job-2": entry("job-2", "driver-a", "not a date")
    });
    expect(byDriver.get("driver-a")?.assignmentId).toBe("job-1");
  });

  it("is empty for a project with no check-ins yet", () => {
    expect(latestEvidenceByDriver({}).size).toBe(0);
  });
});
