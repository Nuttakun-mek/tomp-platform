import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/scoped-client", () => ({ resolveReadClient: async () => ({ client: null }) }));
vi.mock("@/lib/db/postgres", () => ({ getPostgresClient: () => null }));

const { withDriverShifts } = await import("./assignment-status");

const NOW = Date.parse("2026-10-02T12:00:00Z");
const row = (assignment_id: string, status: string, hoursAgo: number, driver_id = "d1") => ({
  assignment_id,
  driver_id,
  status,
  created_at: new Date(NOW - hoursAgo * 3_600_000).toISOString()
});

describe("withDriverShifts", () => {
  it("gives the next open job of the shift the driver's clock-in", () => {
    const sessions = withDriverShifts(
      [row("job1", "work_started", 3)],
      [
        { id: "job1", driver_id: "d1", status: "completed" },
        { id: "job2", driver_id: "d1", status: "acknowledged" }
      ],
      NOW
    );
    expect(sessions.job2?.status).toBe("active");
    expect(sessions.job2?.startedAt).toBe(sessions.job1?.startedAt);
  });

  it("does not carry yesterday's clock-in, another driver's, or into a closed job", () => {
    const sessions = withDriverShifts(
      [row("job1", "work_started", 20), row("x", "work_started", 1, "d2")],
      [
        { id: "job2", driver_id: "d1", status: "planned" },
        { id: "job3", driver_id: "d2", status: "cancelled" }
      ],
      NOW
    );
    expect(sessions.job2).toBeUndefined();
    expect(sessions.job3).toBeUndefined();
  });
});
