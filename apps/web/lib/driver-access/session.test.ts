import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mintDriverSession, verifyDriverSession } from "./session";

const base = { tid: "t1", pid: "p1", aid: "a1", did: "d1", dev: "devhash" };

describe("driver session token", () => {
  it("round-trips a valid session", () => {
    const value = mintDriverSession(base);
    const payload = verifyDriverSession(value);
    expect(payload).toMatchObject(base);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered body", () => {
    const value = mintDriverSession(base);
    const [body, sig] = value.split(".");
    const swapped = Buffer.from(JSON.stringify({ ...base, aid: "OTHER", exp: 9999999999 }), "utf8").toString("base64url");
    expect(verifyDriverSession(`${swapped}.${sig}`)).toBeNull();
    expect(verifyDriverSession(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects an expired session", () => {
    const body = Buffer.from(JSON.stringify({ ...base, exp: Math.floor(Date.now() / 1000) - 10 }), "utf8").toString("base64url");
    const sig = createHmac("sha256", "development-driver-token-secret").update(`dsess:${body}`).digest("base64url");
    expect(verifyDriverSession(`${body}.${sig}`)).toBeNull();
  });

  it("rejects junk", () => {
    expect(verifyDriverSession(null)).toBeNull();
    expect(verifyDriverSession("")).toBeNull();
    expect(verifyDriverSession("noseparator")).toBeNull();
  });
});
