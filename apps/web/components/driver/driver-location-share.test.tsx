// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION, NATIVE_STATUS_EVENT, buildNativeStatusMessage } from "@tomp/driver-core";
import { buildDriverAccess } from "./test-fixtures";
import { DriverLocationShare } from "./driver-location-share";

const access = { ...buildDriverAccess(), token: "tomp_test_token_abcdef0123456789" };

function installShell(platform = "ios") {
  const postMessage = vi.fn();
  (window as { TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL = { namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, platform, canBackgroundLocation: true, postMessage };
  return postMessage;
}

function nativeStatus(detail: Record<string, unknown>) {
  const message = buildNativeStatusMessage("gps_sharing", "กำลังส่งตำแหน่ง GPS จากแอป", detail, { canBackgroundLocation: true });
  act(() => {
    window.dispatchEvent(new CustomEvent(NATIVE_STATUS_EVENT, { detail: message }));
  });
}

afterEach(() => {
  cleanup();
  delete (window as { TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL;
  window.localStorage.clear();
});

describe("DriverLocationShare", () => {
  it("starts sharing when the page signals a clock-in, once per signal", () => {
    const postMessage = installShell();
    const { rerender } = render(<DriverLocationShare driverAccess={access} startRequest={0} />);
    const starts = () => postMessage.mock.calls.filter(([m]) => m.type === "gps.start").length;
    expect(starts()).toBe(0);

    rerender(<DriverLocationShare driverAccess={access} startRequest={1} />);
    expect(starts()).toBe(1);
    rerender(<DriverLocationShare driverAccess={access} startRequest={1} />);
    expect(starts()).toBe(1);
  });

  it("keeps an 'Always' warning up when the app reports background permission denied", () => {
    installShell("ios");
    render(<DriverLocationShare driverAccess={access} />);
    nativeStatus({ backgroundGps: { started: false, reason: "permission_denied" } });
    expect(screen.getByText(/ตั้งค่าตำแหน่งเป็น “ตลอดเวลา”/)).toBeTruthy();

    // A later ping replaces the message line but not the warning.
    nativeStatus({ latitude: 13.7, longitude: 100.5, accuracy: 10, recordedAt: new Date().toISOString() });
    expect(screen.getByText(/ตั้งค่าตำแหน่งเป็น “ตลอดเวลา”/)).toBeTruthy();
  });

  it("remembers the warning across a remount and clears it once Always is granted", () => {
    installShell("android");
    const first = render(<DriverLocationShare driverAccess={access} />);
    nativeStatus({ backgroundGps: { started: false, reason: "permission_denied" } });
    first.unmount();

    render(<DriverLocationShare driverAccess={access} />);
    expect(screen.getByText(/อนุญาตตลอดเวลา/)).toBeTruthy();

    nativeStatus({ backgroundGps: { started: true, reason: "started" } });
    expect(screen.queryByText(/ตั้งค่าตำแหน่งเป็น “ตลอดเวลา”/)).toBeNull();
  });

  it("inside the app, stays 'sharing' when a parked car sends no new fix, and tells the header the same", () => {
    vi.useFakeTimers();
    try {
      installShell();
      const onStatusChange = vi.fn();
      render(<DriverLocationShare driverAccess={access} onStatusChange={onStatusChange} />);
      nativeStatus({ latitude: 13.7, longitude: 100.5, accuracy: 10, recordedAt: new Date().toISOString() });
      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });
      expect(onStatusChange).not.toHaveBeenCalledWith("stale");
      expect(onStatusChange).toHaveBeenLastCalledWith("live");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens closed, showing only the sending status until tapped", () => {
    installShell();
    render(<DriverLocationShare driverAccess={access} />);
    const header = screen.getByRole("button", { name: /การส่งตำแหน่ง GPS/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows no warning in a plain browser", () => {
    window.localStorage.setItem("tomp_gps_always_needed_abcdef0123456789", "1");
    render(<DriverLocationShare driverAccess={access} />);
    expect(screen.queryByText(/ตั้งค่าตำแหน่งเป็น “ตลอดเวลา”/)).toBeNull();
  });
});
