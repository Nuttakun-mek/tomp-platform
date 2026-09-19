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
});
