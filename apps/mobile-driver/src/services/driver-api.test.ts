import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAssignmentBySession, submitLocation } from "./driver-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockJsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload)
  } as Response;
}

describe("driver-api session contract", () => {
  it("does not fetch an assignment without a mobile session", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchAssignmentBySession(null);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the assignment with x-driver-session instead of a token query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(200, { success: true, data: { packet: { id: "packet-1" } } }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchAssignmentBySession({ session: "signed-session", expiresAt: "2099-01-01T00:00:00.000Z" });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/driver\/assignment$/),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-driver-session": "signed-session" })
      })
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("?token=");
  });

  it("normalises server errors even when the payload omits success=false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(500, { error: "server failed" }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await submitLocation(
      {
        latitude: 13.7563,
        longitude: 100.5018,
        recordedAt: "2026-09-10T00:00:00.000Z",
        trackingEvent: "location_ping",
        metadata: {}
      },
      { session: "signed-session", expiresAt: "2099-01-01T00:00:00.000Z" }
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.error).toBe("server failed");
  });
});
