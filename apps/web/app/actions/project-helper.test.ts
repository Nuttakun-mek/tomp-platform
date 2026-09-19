import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory single-row store standing in for project_helper_tokens —
// enough to exercise the full insert -> find -> update(lockout) -> find cycle
// verifyProjectHelperPinAction actually drives, without a real database.
let row: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/server-write", () => ({
  getSupabaseWriteClient: () => ({
    client: {
      from: (table: string) => {
        if (table !== "project_helper_tokens") throw new Error(`unexpected table: ${table}`);
        return {
          insert: (data: Record<string, unknown>) => {
            row = { id: "helper-token-1", status: "active", ...data };
            return { select: () => ({ single: async () => ({ data: { id: row!.id }, error: null }) }) };
          },
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              row = row ? { ...row, ...patch } : row;
              return { data: null, error: null };
            }
          })
        };
      }
    }
  })
}));

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    }
  })
}));

import { issueProjectHelperToken } from "@/lib/project-helper/tokens";
import { verifyProjectHelperPinAction } from "./project-helper";

describe("verifyProjectHelperPinAction", () => {
  beforeEach(() => {
    row = null;
    cookieJar.clear();
  });

  it("rejects a wrong PIN without setting the session cookie", async () => {
    const issued = await issueProjectHelperToken("project-1", "profile-1", "1234");
    const result = await verifyProjectHelperPinAction({ token: issued!.rawToken, pin: "9999" });
    expect(result.success).toBe(false);
    expect(cookieJar.size).toBe(0);
  });

  it("accepts the correct PIN and sets the session cookie", async () => {
    const issued = await issueProjectHelperToken("project-1", "profile-1", "1234");
    const result = await verifyProjectHelperPinAction({ token: issued!.rawToken, pin: "1234" });
    expect(result.success).toBe(true);
    expect(cookieJar.get(`hpin_${issued!.tokenId}`)).toBe("1");
  });

  it("locks out after 5 wrong attempts and then refuses even the correct PIN until the cooldown passes", async () => {
    const issued = await issueProjectHelperToken("project-1", "profile-1", "1234");

    let lastResult;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      lastResult = await verifyProjectHelperPinAction({ token: issued!.rawToken, pin: "0000" });
    }
    expect(lastResult!.success).toBe(false);
    expect(lastResult!.error).toMatch(/รออีก/);

    // The link is now cooling down — even the RIGHT pin must be refused,
    // proving this is a real lockout and not just "wrong PIN, try again".
    const attemptWithCorrectPin = await verifyProjectHelperPinAction({ token: issued!.rawToken, pin: "1234" });
    expect(attemptWithCorrectPin.success).toBe(false);
    expect(attemptWithCorrectPin.error).toMatch(/รออีก/);
    expect(cookieJar.size).toBe(0);
  });

  it("clears the attempt counter after a correct PIN", async () => {
    const issued = await issueProjectHelperToken("project-1", "profile-1", "1234");
    await verifyProjectHelperPinAction({ token: issued!.rawToken, pin: "0000" });
    await verifyProjectHelperPinAction({ token: issued!.rawToken, pin: "0000" });
    const success = await verifyProjectHelperPinAction({ token: issued!.rawToken, pin: "1234" });
    expect(success.success).toBe(true);

    const metadata = (row as { metadata?: Record<string, unknown> }).metadata ?? {};
    expect(metadata.pinAttempts).toBe(0);
  });

  it("rejects an unknown token", async () => {
    const result = await verifyProjectHelperPinAction({ token: "does-not-exist", pin: "1234" });
    expect(result.success).toBe(false);
  });
});
