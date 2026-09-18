import { describe, expect, it, vi, beforeEach } from "vitest";

// Same mocking style as access.test.ts: mock the project's own dependencies
// as black boxes rather than reaching through to a real Supabase client or
// getViewerAccess()/auth chain.
vi.mock("@/lib/airport-transfer/access", () => ({
  getAirportTransferAccess: vi.fn()
}));
vi.mock("@/lib/airport-transfer/project-role", () => ({
  getAirportTransferProjectRole: vi.fn()
}));
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserProfile: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerDataClient: vi.fn()
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

import { completeAirportTransferTask } from "@/app/airport-transfer/actions";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getAirportTransferProjectRole } from "@/lib/airport-transfer/project-role";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

/**
 * A minimal stand-in for supabase-js's PostgrestFilterBuilder: every filter
 * method (select/eq/lt/update/insert) returns the same chainable object, and
 * that object is itself awaitable (thenable) so code paths that never call
 * .maybeSingle() explicitly — e.g. `await supabase.from(...).update({...}).eq(...)`
 * inside a Promise.all — still resolve to `result` when awaited directly.
 */
function makeQueryBuilder(result: unknown) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    // .maybeSingle() is the real supabase-js shape: { data, error }. A chain
    // that's awaited WITHOUT calling .maybeSingle() (the Promise.all entries,
    // and the plain `{ count }`/`{ error }` destructures) instead resolves
    // through .then() directly to the raw queued value — that's the shape
    // completeAirportTransferTask() actually destructures in those spots.
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
  };
  return builder;
}

/**
 * completeAirportTransferTask() calls supabase.from(...) 8 times in a fixed
 * order for the "admin bypass, task completes, status advances" success
 * path. This queues one canned response per call, in that exact order, and
 * throws loudly if the function ever calls .from() more or fewer times than
 * expected — a silent `undefined` response would otherwise mask a real
 * behavior change as a confusing downstream failure instead of a clear one.
 */
function mockSupabaseSequence(responses: unknown[]) {
  const queue = [...responses];
  const from = vi.fn(() => {
    if (!queue.length) throw new Error("supabase.from() called more times than this test expected");
    return makeQueryBuilder(queue.shift());
  });
  return { from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("completeAirportTransferTask (project-scoped access)", () => {
  it("resolves access from the case's own project_id, and lets an admin on that project complete the task", async () => {
    (getCurrentUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "profile-1" });
    (getAirportTransferAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      canManage: true,
      role: "airport_admin",
      profileId: "profile-1",
      signedIn: true
    });

    const activeCase = { operational_status: "verified", deleted_at: null, project_id: PROJECT_ID };
    const task = { id: TASK_ID, task_key: "flight_verified", status: "pending", sequence: 1, owner_role: "airport_dispatcher" };
    const supabase = mockSupabaseSequence([
      activeCase, // 1. select case
      task, // 2. select task
      { count: 0 }, // 3. count unfinished earlier tasks
      { error: null }, // 4. update task -> completed
      { operational_status: "verified" }, // 5. select current case status
      { error: null }, // 6. update case operational_status (Promise.all)
      { error: null }, // 7. insert status event (Promise.all)
      { error: null } // 8. insert audit log
    ]);
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);

    await completeAirportTransferTask(CASE_ID, TASK_ID);

    // The case read must happen before getAirportTransferAccess is called,
    // and access must be scoped by that case's project_id — not called
    // unscoped and not called before the project_id is known.
    expect(getAirportTransferAccess).toHaveBeenCalledWith(PROJECT_ID);

    // Admin bypass: canManage: true means the Layer 3 ownership check
    // (getAirportTransferProjectRole) must be skipped entirely.
    expect(getAirportTransferProjectRole).not.toHaveBeenCalled();

    // The task update call (4th supabase.from() call) actually marked the
    // task completed — pin that the scoped access call didn't accidentally
    // deny a legitimate admin before reaching this point.
    const taskUpdateCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[3].value as { update: ReturnType<typeof vi.fn> };
    expect(taskUpdateCall.update).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
  });

  it("calls getAirportTransferAccess with undefined, not the string 'null', when the case has no project_id", async () => {
    (getCurrentUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "profile-1" });
    (getAirportTransferAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      canManage: false,
      role: null,
      profileId: "profile-1",
      signedIn: true
    });

    const activeCase = { operational_status: "verified", deleted_at: null, project_id: null };
    const supabase = mockSupabaseSequence([activeCase]);
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);

    await completeAirportTransferTask(CASE_ID, TASK_ID);

    expect(getAirportTransferAccess).toHaveBeenCalledWith(undefined);
  });

  it("denies a project_manager (not admin/dispatcher) who tries to complete a step that isn't their own duty", async () => {
    (getCurrentUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "profile-2" });
    (getAirportTransferAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      canManage: false,
      role: "airport_driver",
      profileId: "profile-2",
      signedIn: true
    });
    (getAirportTransferProjectRole as ReturnType<typeof vi.fn>).mockResolvedValue("airport_driver");

    const activeCase = { operational_status: "verified", deleted_at: null, project_id: PROJECT_ID };
    const task = { id: TASK_ID, task_key: "flight_verified", status: "pending", sequence: 1, owner_role: "airport_dispatcher" };
    const supabase = mockSupabaseSequence([activeCase, task]);
    (getSupabaseServerDataClient as ReturnType<typeof vi.fn>).mockReturnValue(supabase);

    await completeAirportTransferTask(CASE_ID, TASK_ID);

    expect(getAirportTransferAccess).toHaveBeenCalledWith(PROJECT_ID);
    expect(getAirportTransferProjectRole).toHaveBeenCalledWith(PROJECT_ID, "profile-2");
    // Only 2 supabase.from() calls (case read, task read) — it must return
    // before ever reaching the task update call.
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
