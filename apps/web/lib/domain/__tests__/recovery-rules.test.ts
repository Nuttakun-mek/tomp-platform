import { describe, expect, it } from "vitest";
import { buildRecoveryRecommendation, mapRecoveryActionToThai, shouldEscalateIncident } from "../recovery-rules";

describe("recovery rules", () => {
  it("escalates critical incidents immediately", () => {
    expect(shouldEscalateIncident("critical", 0)).toBe(true);
  });

  it("recommends vehicle replacement for vehicle issues", () => {
    const recommendation = buildRecoveryRecommendation({ issueType: "vehicle", severity: "urgent", minutesOpen: 2 });
    expect(recommendation.actions).toContain("replace_vehicle");
    expect(recommendation.riskLabel).toBe("เร่งด่วน");
  });

  it("maps recovery action labels to Thai", () => {
    expect(mapRecoveryActionToThai("contact_driver")).toBe("ติดต่อคนขับ");
  });
});
