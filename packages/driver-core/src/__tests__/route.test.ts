import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsUrl, buildRouteInstructionSummary, compareRouteChangeImpact } from "../route";

describe("driver route rules", () => {
  it("builds Google Maps direction URL", () => {
    expect(buildGoogleMapsDirectionsUrl("สนามบิน", "โรงแรม")).toContain("google.com/maps/dir");
  });

  it("summarizes stops", () => {
    expect(buildRouteInstructionSummary([{ label: "จุดรับ" }, { label: "จุดส่ง" }])).toContain("จุดรับ");
  });

  it("detects route impact", () => {
    expect(compareRouteChangeImpact({ summary: "A", stops: [], metadata: {} }, { summary: "B", stops: [], metadata: {} })).toBe("รายละเอียดเส้นทางเปลี่ยนแปลง");
  });
});
