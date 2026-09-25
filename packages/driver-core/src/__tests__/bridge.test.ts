import { describe, expect, it } from "vitest";
import {
  BRIDGE_NAMESPACE,
  BRIDGE_VERSION,
  buildBridgeMessage,
  buildNativeStatusMessage,
  buildViewSwitchMessage,
  getMobileShell,
  isInsideMobileShell,
  isMobileShell,
  parseBridgeMessage,
  parseNativeStatusDetail,
  parseViewSwitchDetail
} from "../bridge";

const shell = {
  namespace: BRIDGE_NAMESPACE,
  version: BRIDGE_VERSION,
  canBackgroundLocation: true,
  postMessage: () => undefined
};

describe("mobile shell detection", () => {
  it("accepts a well-formed handle", () => {
    expect(isMobileShell(shell)).toBe(true);
    expect(getMobileShell({ TOMP_MOBILE_SHELL: shell })).toBe(shell);
  });

  it("rejects a foreign namespace or a version bump", () => {
    expect(isMobileShell({ ...shell, namespace: "other" })).toBe(false);
    expect(isMobileShell({ ...shell, version: BRIDGE_VERSION + 1 })).toBe(false);
  });

  it("rejects a handle without postMessage", () => {
    expect(isMobileShell({ namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION })).toBe(false);
  });

  it("returns null in a plain browser", () => {
    expect(getMobileShell({})).toBeNull();
    expect(getMobileShell(undefined)).toBeNull();
    expect(getMobileShell({ TOMP_MOBILE_SHELL: { namespace: "tomp.driver" } })).toBeNull();
  });

  it("builds a working handle from ReactNativeWebView when the app's handle never arrived", () => {
    // Every app build up to 1.0.0 (9) injected its handle at document start,
    // before <head> existed; document.head.appendChild threw and the handle was
    // never set. The page then shared GPS from the browser, which stops as soon
    // as the app leaves the screen. The WebView's own bridge is always there.
    const sent: string[] = [];
    const container = {
      ReactNativeWebView: { postMessage: (raw: string) => sent.push(raw) },
      navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" }
    };
    const handle = getMobileShell(container);
    expect(handle?.canBackgroundLocation).toBe(true);
    expect(handle?.platform).toBe("ios");
    handle?.postMessage(buildBridgeMessage("gps.start", { reason: "driver_requested" }));
    expect(parseBridgeMessage(sent[0])?.type).toBe("gps.start");
  });

  it("prefers the app's own handle when it exists", () => {
    const withBoth = { TOMP_MOBILE_SHELL: shell, ReactNativeWebView: { postMessage: () => undefined } };
    expect(getMobileShell(withBoth)).toBe(shell);
  });

  it("still detects the native WebView when the typed shell handle is unavailable", () => {
    expect(isInsideMobileShell({ ReactNativeWebView: { postMessage: () => undefined } })).toBe(true);
    expect(isInsideMobileShell({ TOMP_MOBILE_SHELL: { namespace: "tomp.driver" }, ReactNativeWebView: { postMessage: () => undefined } })).toBe(true);
    expect(isInsideMobileShell({})).toBe(false);
  });
});

describe("bridge messages", () => {
  it("builds a stamped message", () => {
    expect(buildBridgeMessage("gps.start", { reason: "driver_requested" })).toEqual({
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      type: "gps.start",
      payload: { reason: "driver_requested" }
    });
  });

  it("lets the page ask the shell to leave a job that no longer exists", () => {
    const message = buildBridgeMessage("job.leave", { reason: "link_not_found" });
    expect(parseBridgeMessage(JSON.stringify(message))).toEqual(message);
  });

  it("round-trips through parseBridgeMessage", () => {
    const message = buildBridgeMessage("mobile-session.challenge", { code: "abc", expiresAt: "2026-01-01T00:00:00.000Z" });
    expect(parseBridgeMessage(JSON.stringify(message))).toEqual(message);
  });

  it("lets the page ask the shell what the GPS is doing", () => {
    // Switching driver tabs remounts the page with its sharing state reset, and
    // the status the shell posts on navigation arrives before the page is
    // listening. Without a question the page cannot recover, and it offers to
    // start a session that is already running.
    const message = buildBridgeMessage("gps.status.request", { reason: "page_mounted" });
    expect(parseBridgeMessage(JSON.stringify(message))).toEqual(message);
    // The payload is optional, like the other gps.* messages.
    expect(parseBridgeMessage(JSON.stringify(buildBridgeMessage("gps.status.request")))).toEqual(
      buildBridgeMessage("gps.status.request")
    );
  });

  it("supports unread driver notification signals", () => {
    const message = buildBridgeMessage("driver.notification.unread", { count: 2 });
    expect(parseBridgeMessage(JSON.stringify(message))).toEqual(message);
  });

  it("rejects malformed, foreign and wrong-version payloads", () => {
    expect(parseBridgeMessage("not json")).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ namespace: "other", version: BRIDGE_VERSION, type: "gps.start" }))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ namespace: BRIDGE_NAMESPACE, version: 99, type: "gps.start" }))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify(buildBridgeMessage("open.url")))).toBeNull();
    expect(
      parseBridgeMessage(JSON.stringify({ namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, type: "mobile-session.set", payload: { session: 1 } }))
    ).toBeNull();
  });
});

describe("native status", () => {
  it("carries the background capability the shell reports, whatever the status", () => {
    expect(buildNativeStatusMessage("gps_sharing", "ok", undefined, { canBackgroundLocation: false }).payload.canBackgroundLocation).toBe(false);
    expect(buildNativeStatusMessage("session_missing", "no session", undefined, { canBackgroundLocation: true }).payload.canBackgroundLocation).toBe(true);
  });

  it("parses only a detail that carries a status", () => {
    const message = buildNativeStatusMessage("gps_stopped", "stopped", undefined, { canBackgroundLocation: true });
    expect(parseNativeStatusDetail(message)?.status).toBe("gps_stopped");
    expect(parseNativeStatusDetail({ payload: {} })).toBeNull();
    expect(parseNativeStatusDetail(null)).toBeNull();
  });
});

describe("view switch", () => {
  it("builds a message for a valid view", () => {
    expect(buildViewSwitchMessage("next")).toEqual({
      namespace: BRIDGE_NAMESPACE,
      version: BRIDGE_VERSION,
      type: "view.switch",
      payload: { view: "next" }
    });
  });

  it("parses a valid detail and rejects everything else", () => {
    const message = buildViewSwitchMessage("messages");
    expect(parseViewSwitchDetail(message)).toBe("messages");
    expect(parseViewSwitchDetail({ payload: { view: "not-a-real-view" } })).toBeNull();
    expect(parseViewSwitchDetail({ payload: {} })).toBeNull();
    expect(parseViewSwitchDetail(null)).toBeNull();
  });
});
