import { describe, expect, it } from "vitest";
import { decideWebViewNavigation } from "./webview-navigation";

describe("webview navigation allow-list", () => {
  it("allows TOMP driver pages", () => {
    expect(decideWebViewNavigation("https://tomp-platform.vercel.app/driver/tomp_live_123")).toEqual({ action: "allow" });
  });

  it("opens same-origin non-driver pages outside the shell", () => {
    expect(decideWebViewNavigation("https://tomp-platform.vercel.app/mission-control")).toEqual({
      action: "external",
      url: "https://tomp-platform.vercel.app/mission-control"
    });
  });

  it("opens Google Maps outside the shell", () => {
    expect(decideWebViewNavigation("https://www.google.com/maps/search/?api=1&query=13.7,100.5")).toEqual({
      action: "external",
      url: "https://www.google.com/maps/search/?api=1&query=13.7,100.5"
    });
  });

  it("blocks unrelated websites", () => {
    expect(decideWebViewNavigation("https://example.com")).toEqual({
      action: "block",
      reason: "แอปอนุญาตเฉพาะหน้า TOMP สำหรับคนขับและ Google Maps"
    });
  });
});
