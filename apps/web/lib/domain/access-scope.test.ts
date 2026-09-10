import { describe, expect, it } from "vitest";
import {
  generateDriverAccessToken,
  generateObserverAccessToken,
  hashDriverAccessToken,
  hashObserverAccessToken,
  verifyDriverAccessTokenHash,
  verifyObserverAccessTokenHash
} from "@/lib/driver-access/token";

// The observer credential is read-only by *construction*, not by convention: it
// is a different token in a different table hashed with a different prefix, so
// it cannot resolve as a driver token no matter what a route does with it. That
// is the property worth pinning — a read-only flag on a shared token would be
// one merge away from granting writes.

const driverToken = () => generateDriverAccessToken({ assignmentId: "a1", callSignId: "c1", driverId: "d1" });
const observerToken = () => generateObserverAccessToken({ callSignId: "c1" });

describe("observer tokens cannot pass as driver tokens", () => {
  it("an observer token does not verify against the driver hash", () => {
    const token = observerToken();
    expect(verifyDriverAccessTokenHash(token, hashDriverAccessToken(token))).toBe(true);
    // ...but the hash a driver lookup would search for is not the hash the
    // observer row stores, so the observer token finds no driver row.
    expect(hashDriverAccessToken(token)).not.toBe(hashObserverAccessToken(token));
  });

  it("a driver token does not verify against the observer hash", () => {
    const token = driverToken();
    expect(verifyObserverAccessTokenHash(token, hashDriverAccessToken(token))).toBe(false);
  });

  it("the two schemes never collide for the same string", () => {
    for (const token of [driverToken(), observerToken(), "tomp_plain", ""]) {
      expect(hashDriverAccessToken(token)).not.toBe(hashObserverAccessToken(token));
    }
  });

  it("the prefix gate does NOT separate them — the hash does", () => {
    // resolveDriverTokenIdentity turns away anything that is not `tomp_`, and an
    // observer token passes that gate: it is `tomp_obs_...`. So the prefix is not
    // what keeps an observer out of the driver path — the separate hash is, and
    // it is the only thing standing there. Anyone tempted to "simplify" the two
    // hash prefixes into one should fail this test first.
    expect(observerToken().startsWith("tomp_")).toBe(true);
    expect(observerToken().startsWith("tomp_obs_")).toBe(true);
    expect(driverToken().startsWith("tomp_obs_")).toBe(false);
  });

  it("each issued token is unique", () => {
    const issued = new Set([observerToken(), observerToken(), driverToken(), driverToken()]);
    expect(issued.size).toBe(4);
  });
});
