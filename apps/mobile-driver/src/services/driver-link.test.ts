import { describe, expect, it } from "vitest";
import { extractDriverToken, isTompDriverWebUrl, parseDriverLink } from "./driver-link";

describe("driver link parser", () => {
  it("extracts a raw token", () => {
    expect(extractDriverToken(" tomp_live_123 ")).toBe("tomp_live_123");
  });

  it("extracts a token from the web driver URL", () => {
    expect(extractDriverToken("https://tomp-platform.vercel.app/driver/tomp_live_abc")).toBe("tomp_live_abc");
  });

  it("extracts a token from deep link query params", () => {
    expect(extractDriverToken("tompdriver://open?token=tomp_live_xyz")).toBe("tomp_live_xyz");
  });

  it("builds a canonical web URL for the WebView", () => {
    expect(parseDriverLink("tomp_live_123")?.webUrl).toBe("https://tomp-platform.vercel.app/driver/tomp_live_123?lang=th");
  });

  it("preserves a supported language hint without changing the token", () => {
    const result = parseDriverLink("https://tomp-platform.vercel.app/driver/tomp_live_abc?lang=en");
    expect(result?.token).toBe("tomp_live_abc");
    expect(result?.locale).toBe("en");
    expect(result?.webUrl).toBe("https://tomp-platform.vercel.app/driver/tomp_live_abc?lang=en");
  });

  it("recognizes allowed TOMP driver web paths", () => {
    expect(isTompDriverWebUrl("https://tomp-platform.vercel.app/driver/tomp_live_123")).toBe(true);
    expect(isTompDriverWebUrl("https://example.com/driver/tomp_live_123")).toBe(false);
  });
});
