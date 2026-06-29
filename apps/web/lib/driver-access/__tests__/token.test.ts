import { describe, expect, it } from "vitest";
import { generateDriverAccessToken, hashDriverAccessToken, verifyDriverAccessTokenHash } from "../token";

describe("driver access tokens", () => {
  it("generates and verifies hashed driver tokens", () => {
    const token = generateDriverAccessToken({ assignmentId: "assignment-1", driverId: "driver-1" });
    const hash = hashDriverAccessToken(token);

    expect(token).toContain("tomp_assignment-1_driver-1_");
    expect(hash).toHaveLength(64);
    expect(verifyDriverAccessTokenHash(token, hash)).toBe(true);
  });
});
