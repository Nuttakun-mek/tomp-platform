import { describe, expect, it } from "vitest";
import { gpsFreshness, gpsFreshnessLabelTh, gpsFreshnessTone } from "./gps-freshness";

const NOW = new Date("2026-09-08T12:00:00Z").getTime();
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("gpsFreshness", () => {
  it("treats a stopped share as stopped regardless of age", () => {
    expect(gpsFreshness(ago(2), "sharing_stopped", NOW)).toBe("stopped");
  });

  it("buckets by age around the 35s / 120s thresholds", () => {
    expect(gpsFreshness(ago(0), null, NOW)).toBe("live");
    expect(gpsFreshness(ago(35), null, NOW)).toBe("live");
    expect(gpsFreshness(ago(36), null, NOW)).toBe("slow");
    expect(gpsFreshness(ago(120), null, NOW)).toBe("slow");
    expect(gpsFreshness(ago(121), null, NOW)).toBe("offline");
  });

  it("is offline when there is no usable timestamp", () => {
    expect(gpsFreshness(null, null, NOW)).toBe("offline");
    expect(gpsFreshness("not-a-date", null, NOW)).toBe("offline");
  });

  it("clamps clock-skewed future stamps to live", () => {
    expect(gpsFreshness(new Date(NOW + 5000), null, NOW)).toBe("live");
  });
});

describe("labels and tones", () => {
  it("maps every state to a Thai label and a tone", () => {
    expect(gpsFreshnessLabelTh("live")).toBe("GPS สด");
    expect(gpsFreshnessLabelTh("stopped")).toBe("หยุดแชร์");
    expect(gpsFreshnessTone("live")).toBe("success");
    expect(gpsFreshnessTone("slow")).toBe("warning");
    expect(gpsFreshnessTone("offline")).toBe("danger");
  });
});
