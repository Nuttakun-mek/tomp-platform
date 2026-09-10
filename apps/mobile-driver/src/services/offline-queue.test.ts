import { beforeEach, describe, expect, it, vi } from "vitest";

const locationRow = {
  id: "row-1",
  kind: "location",
  payload: JSON.stringify({
    latitude: 13.7563,
    longitude: 100.5018,
    recordedAt: "2026-09-10T00:00:00.000Z",
    trackingEvent: "location_ping",
    metadata: {}
  }),
  created_at: "2026-09-10T00:00:00.000Z",
  attempt_count: 0
};

const runAsync = vi.fn();
const execAsync = vi.fn();
const getAllAsync = vi.fn(async (query: string) => {
  if (query.includes("count(*)")) return [{ count: 0 }];
  return [locationRow];
});
const submitLocation = vi.fn(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { success: true, statusCode: 200 };
});

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn(async () => ({
    execAsync,
    getAllAsync,
    runAsync
  }))
}));

vi.mock("./driver-api", () => ({
  submitIssueReport: vi.fn(),
  submitLocation,
  submitReadiness: vi.fn(),
  submitStatusUpdate: vi.fn()
}));

vi.mock("./mobile-session-store", () => ({
  getMobileDriverSession: vi.fn(async () => ({
    session: "signed-session",
    expiresAt: "2099-01-01T00:00:00.000Z"
  }))
}));

describe("offline queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shares one in-flight flush instead of replaying the same rows twice", async () => {
    const { flushOfflineQueue } = await import("./offline-queue");

    const first = flushOfflineQueue();
    const second = flushOfflineQueue();

    expect(second).toBe(first);

    const result = await first;

    expect(result.sent).toBe(1);
    expect(submitLocation).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledWith("delete from driver_outbox where id = ?", ["row-1"]);
  });
});
