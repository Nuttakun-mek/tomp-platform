import { describe, expect, it } from "vitest";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION, buildNativeStatusMessage, parseBridgeMessage } from "./protocol";

describe("mobile bridge protocol", () => {
  it("accepts supported gps commands", () => {
    const message = JSON.stringify({ namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, type: "gps.start" });
    expect(parseBridgeMessage(message)).toEqual({ namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, type: "gps.start" });
  });

  it("rejects invalid namespace", () => {
    const message = JSON.stringify({ namespace: "wrong", version: BRIDGE_VERSION, type: "gps.start" });
    expect(parseBridgeMessage(message)).toBeNull();
  });

  it("rejects incomplete session payloads", () => {
    const message = JSON.stringify({ namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, type: "mobile-session.set", payload: { session: "abc" } });
    expect(parseBridgeMessage(message)).toBeNull();
  });

  it("accepts one-time mobile session challenges", () => {
    const message = JSON.stringify({
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      type: "mobile-session.challenge",
      payload: { code: "abc", expiresAt: "2026-09-09T10:00:00.000Z" }
    });
    expect(parseBridgeMessage(message)?.type).toBe("mobile-session.challenge");
  });

  it("builds status messages for WebView", () => {
    const status = buildNativeStatusMessage("session_missing", "รอ session จากระบบ");
    expect(status.payload.canBackgroundLocation).toBe(false);
    expect(status.payload.message).toBe("รอ session จากระบบ");
  });
});
