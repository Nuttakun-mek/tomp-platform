import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("public path guard", () => {
  it("allows public customer and driver entry routes intentionally", () => {
    expect(isPublicPath("/driver/abc")).toBe(true);
    expect(isPublicPath("/fleet/abc")).toBe(true);
    expect(isPublicPath("/track/abc")).toBe(true);
  });

  it("keeps protected app routes protected and respects path boundaries", () => {
    expect(isPublicPath("/projects")).toBe(false);
    expect(isPublicPath("/mission-control")).toBe(false);
    expect(isPublicPath("/fleetwise")).toBe(false);
  });
});
