// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION } from "@tomp/driver-core";
import { browserLocation, photoLocation } from "./capture-location";

function stubGeolocation(impl: Geolocation["getCurrentPosition"]) {
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: impl } });
}

afterEach(() => {
  vi.useRealTimers();
  delete (window as { TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL;
});

describe("browserLocation", () => {
  it("gives up after its deadline when the permission prompt never answers (the stuck-upload bug)", async () => {
    vi.useFakeTimers();
    stubGeolocation(() => {
      /* never calls back — what a WebView does while a hidden prompt waits */
    });
    const pending = browserLocation(3000);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBeNull();
  });

  it("returns the position when the browser answers", async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 13.7, longitude: 100.5, accuracy: 9 }, timestamp: Date.UTC(2026, 8, 30, 5) } as GeolocationPosition));
    await expect(browserLocation()).resolves.toMatchObject({ latitude: 13.7, longitude: 100.5, accuracy: 9 });
  });
});

describe("photoLocation", () => {
  it("inside the app, asks the app and does not wait long on the browser", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    (window as { TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL = { namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, platform: "ios", canBackgroundLocation: true, postMessage };
    stubGeolocation(() => {});
    const pending = photoLocation();
    await vi.advanceTimersByTimeAsync(1500 + 3000);
    await expect(pending).resolves.toBeNull();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "gps.status.request" }));
  });
});
