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

  it("does not put yesterday's unclosed clock-in on this morning's job", () => {
    // Van-01: clocked in 30 Sep 17:56, never clocked out; 1 Oct 08:00 job, pre-start check at 07:27.
    const at = (bkk: string) => new Date(`${bkk}+07:00`).toISOString();
    const sessions = withDriverShifts(
      [{ assignment_id: "evening", driver_id: "d1", status: "work_started", created_at: at("2026-09-30T17:56:05") }],
      [
        { id: "evening", driver_id: "d1", status: "completed", start_time: at("2026-09-30T18:00:00") },
        { id: "morning", driver_id: "d1", status: "active", start_time: at("2026-10-01T08:00:00") }
      ],
      Date.parse(at("2026-10-01T07:30:00"))
    );
    expect(sessions.morning).toBeUndefined();
  });

  it("keeps a late job's clock-in after midnight, and shows a clock-out only for the session it closes", () => {
    const at = (bkk: string) => new Date(`${bkk}+07:00`).toISOString();
    const sessions = withDriverShifts(
      [
        { assignment_id: "early", driver_id: "d1", status: "work_ended", created_at: at("2026-09-30T12:00:00") },
        { assignment_id: "early", driver_id: "d1", status: "work_started", created_at: at("2026-09-30T08:00:00") },
        { assignment_id: "x", driver_id: "d1", status: "work_started", created_at: at("2026-09-30T20:00:00") }
      ],
      [{ id: "late", driver_id: "d1", status: "active", start_time: at("2026-09-30T23:00:00") }],
      Date.parse(at("2026-10-01T00:40:00"))
    );
    expect(sessions.late?.status).toBe("active");
    expect(sessions.late?.startedAt).toBe(at("2026-09-30T20:00:00"));
    expect(sessions.late?.endedAt).toBeNull();
  });
});
