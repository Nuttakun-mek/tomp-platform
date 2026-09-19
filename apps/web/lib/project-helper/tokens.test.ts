import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";

const rows: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/server-write", () => ({
  getSupabaseWriteClient: () => ({
    client: {
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          const id = "token-1";
          rows.push({ id, status: "active", ...row });
          return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
        },
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[rows.length - 1] ?? null, error: null }) }) })
      })
    }
  })
}));

import { findProjectHelperToken, issueProjectHelperToken, verifyProjectHelperPin } from "./tokens";

describe("project helper tokens", () => {
  it("verifies the PIN that was set at issue time", async () => {
    const issued = await issueProjectHelperToken("project-1", "profile-1", "1234");
    expect(issued).not.toBeNull();
    const claim = await findProjectHelperToken(issued!.rawToken);
    expect(claim).not.toBeNull();
    expect(verifyProjectHelperPin(claim!, "1234")).toBe(true);
    expect(verifyProjectHelperPin(claim!, "9999")).toBe(false);
  });

  it("stores the PIN peppered — the hash is NOT reproducible via bare sha256(pin), proving a secret is mixed in", async () => {
    const issued = await issueProjectHelperToken("project-2", "profile-2", "5678");
    const claim = await findProjectHelperToken(issued!.rawToken);
    expect(claim).not.toBeNull();

    const bareHash = createHash("sha256").update("5678").digest("hex");
    expect(claim!.pinHash).not.toBeNull();
    expect(claim!.pinHash).not.toBe(bareHash);

    // Same input, same pepper (the dev fallback secret, since no
    // PROJECT_HELPER_PIN_SECRET is set in the test environment) must still
    // hash deterministically, or verifyProjectHelperPin could never work.
    const issuedAgain = await issueProjectHelperToken("project-3", "profile-3", "5678");
    const claimAgain = await findProjectHelperToken(issuedAgain!.rawToken);
    expect(claimAgain!.pinHash).toBe(claim!.pinHash);
  });

  it("rejects a PIN when no hash was ever set on the claim", () => {
    const claimWithoutPin = { tokenId: "t", projectId: "p", profileId: "pr", pinHash: null, metadata: {} };
    expect(verifyProjectHelperPin(claimWithoutPin, "1234")).toBe(false);
  });
});
