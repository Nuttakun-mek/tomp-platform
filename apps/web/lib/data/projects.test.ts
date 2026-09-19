import { describe, expect, it, vi } from "vitest";

// getProjectByCode falls through Supabase -> Postgres -> demo-kernel. The
// Supabase branch calls next/headers' cookies(), which throws outside a
// real request scope — harmless in a credential-less environment (no
// Supabase URL/key means resolveReadClient() short-circuits before ever
// reaching cookies()), but this repo's local dev checkout carries real
// Supabase credentials, so a bare unit test run here hits the real client
// construction path and the cookies() call fails immediately. Mock both
// fallback layers so this test exercises the intended demo-kernel path
// deterministically, regardless of which environment it runs in.
vi.mock("@/lib/supabase/scoped-client", () => ({
  resolveReadClient: vi.fn().mockResolvedValue({ client: null })
}));
vi.mock("@/lib/db/postgres", () => ({
  getPostgresClient: vi.fn().mockReturnValue(null)
}));

import { getProjectByCode } from "./projects";

describe("getProjectByCode", () => {
  it("returns null for a code that matches nothing", async () => {
    const project = await getProjectByCode("NO-SUCH-CODE-EXISTS-0000");
    expect(project).toBeNull();
  });
});
