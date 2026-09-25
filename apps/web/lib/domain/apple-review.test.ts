import { describe, expect, it } from "vitest";
import { isAppleReviewProject } from "./apple-review";

describe("isAppleReviewProject", () => {
  it("recognises the demo by its metadata tag only", () => {
    expect(isAppleReviewProject({ metadata: { appleReview: true } })).toBe(true);
    expect(isAppleReviewProject({ metadata: { appleReview: "true" } })).toBe(false);
    expect(isAppleReviewProject({ metadata: {} })).toBe(false);
  });
});
