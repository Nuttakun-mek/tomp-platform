import { describe, expect, it, vi } from "vitest";

// Regression test for the finding that canManage/canDelete were derived from
// account-wide getViewerAccess() (unioned across EVERY project the viewer
// holds any role on) instead of THIS project — so a project_manager of
// project A opening project B's settings page passed the entry gate (and
// saw project B's member roster + contact numbers) despite holding no role
// on B at all. All three flags now go through requirePermission(project.id,
// ...), so this proves the entry gate — and every data fetch behind it —
// only opens for a viewer requirePermission actually approves for THIS
// project.
const project = {
  id: "project-b",
  organizationId: "org-1",
  projectCode: "PRJ-B",
  projectName: "Project B",
  startDate: "2026-01-01",
  endDate: "2026-01-05",
  timezone: "Asia/Bangkok",
  status: "draft",
  visibilityLevel: "private",
  serviceLevel: "standard",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  metadata: {}
};

const members = [{ profileId: "p1", fullName: "Someone on Project B", email: "someone@example.com", roleKey: "project_manager", systemKey: "ground_transfer", status: "active" }];

// vi.mock factories are hoisted above these top-level consts, so the
// factory can't reference `requirePermission`/`getProjectMembers` directly
// (TDZ — "Cannot access before initialization"). Each factory instead
// returns a small wrapper closure that only looks the const up once it is
// actually CALLED, by which point module init has finished; the wrapper
// forwards its arguments so .mock.calls/toHaveBeenCalledWith below still see
// page.tsx's real call arguments, not the wrapper's own (unused) params.
let requirePermissionResult: { allowed: boolean; reason?: string };
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- rest param exists only to type .mock.calls/toHaveBeenCalledWith below; the mock's return never depends on the arguments.
const requirePermission = vi.fn(async (..._args: unknown[]) => requirePermissionResult);
vi.mock("@/lib/auth/rbac", () => ({ requirePermission: (...args: unknown[]) => requirePermission(...args) }));

// Finding 1's compound-OR fallback: an airport_admin/airport_dispatcher
// passes the Settings gate even though requirePermission() (above) denies
// them outright — the 5 Airport Transfer roles hold zero role_permissions
// rows on purpose, so requirePermission can never approve them. Defaults to
// canManage: false so the two pre-existing tests below are unaffected;
// individual tests override this.
let airportAccessResult: { allowed: boolean; canManage: boolean; role: string | null; profileId: string; signedIn: boolean } = {
  allowed: false,
  canManage: false,
  role: null,
  profileId: "p",
  signedIn: true
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- same as above.
const getAirportTransferAccess = vi.fn(async (..._args: unknown[]) => airportAccessResult);
vi.mock("@/lib/airport-transfer/access", () => ({ getAirportTransferAccess: (...args: unknown[]) => getAirportTransferAccess(...args) }));

vi.mock("@/lib/data/projects", () => ({ getProjectByCode: vi.fn(async () => project) }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- same as above.
const getProjectMembers = vi.fn(async (..._args: unknown[]) => members);
vi.mock("@/lib/data/project-members", () => ({ getProjectMembers: (...args: unknown[]) => getProjectMembers(...args) }));
vi.mock("@/lib/data/project-systems", () => ({ getEnabledSystemKeys: vi.fn(async () => ["ground_transfer"]) }));
vi.mock("@/lib/data/missions", () => ({ getMissionsByProjectId: vi.fn(async () => ({ ok: true, data: [] })) }));
vi.mock("@/lib/data/assignments", () => ({ getAssignmentsByProjectId: vi.fn(async () => ({ ok: true, data: [] })) }));
vi.mock("@/lib/data/operation-days", () => ({ getOperationDaysByProjectId: vi.fn(async () => ({ ok: true, data: [] })) }));

import { AccessDenied } from "@/components/auth/access-denied";
import ProjectSettingsPage from "./page";

describe("ProjectSettingsPage cross-project access", () => {
  it("denies a viewer requirePermission refuses on THIS project (e.g. a project_manager of a DIFFERENT project) and never fetches its member roster", async () => {
    requirePermissionResult = { allowed: false, reason: "No project membership was found." };
    getProjectMembers.mockClear();
    requirePermission.mockClear();

    const element = (await ProjectSettingsPage({ params: Promise.resolve({ projectCode: "PRJ-B" }) })) as unknown as { type: unknown };

    expect(element.type).toBe(AccessDenied);
    // The old bug's disclosure happened because getProjectMembers ran and its
    // result was rendered even though the viewer had no real role on this
    // project. Proving it was never even CALLED is stronger than proving the
    // render was empty — the roster is not fetched for a denied viewer at all.
    expect(getProjectMembers).not.toHaveBeenCalled();
    // Every requirePermission call must be scoped to THIS project's id, not
    // some ambient/account-wide check.
    expect(requirePermission).toHaveBeenCalledWith("project-b", "project.manage_members");
    expect(requirePermission).toHaveBeenCalledWith("project-b", "project.update");
    expect(requirePermission).toHaveBeenCalledWith("project-b", "project.delete");
  });

  it("renders the real page (not AccessDenied) and fetches the roster for a viewer requirePermission approves on this project", async () => {
    requirePermissionResult = { allowed: true };
    getProjectMembers.mockClear();

    const element = (await ProjectSettingsPage({ params: Promise.resolve({ projectCode: "PRJ-B" }) })) as unknown as { type: unknown };

    expect(element.type).not.toBe(AccessDenied);
    expect(getProjectMembers).toHaveBeenCalledWith("project-b");
  });
});

// Regression test for Finding 1 (final whole-branch review): an
// airport_admin-only profile — no Ground Transfer role at all, so
// requirePermission() denies every one of the three checks above, since the
// 5 Airport Transfer roles hold zero role_permissions rows on purpose — must
// still pass this page's entry gate and reach the grant form on their own
// Airport-Transfer-only project, via the compound OR with
// getAirportTransferAccess(project.id).canManage.
describe("ProjectSettingsPage Airport Transfer manager access", () => {
  it("passes the gate and can see/use the grant form for an airport_admin with no Ground Transfer role", async () => {
    requirePermissionResult = { allowed: false, reason: "No project membership was found." };
    airportAccessResult = { allowed: true, canManage: true, role: "airport_admin", profileId: "p1", signedIn: true };
    getProjectMembers.mockClear();

    const element = (await ProjectSettingsPage({ params: Promise.resolve({ projectCode: "PRJ-B" }) })) as unknown as { type: unknown };

    expect(element.type).not.toBe(AccessDenied);
    expect(getProjectMembers).toHaveBeenCalledWith("project-b");
    expect(getAirportTransferAccess).toHaveBeenCalledWith("project-b");
  });

  it("still denies when neither requirePermission nor Airport Transfer's canManage approve", async () => {
    requirePermissionResult = { allowed: false, reason: "No project membership was found." };
    airportAccessResult = { allowed: true, canManage: false, role: "airport_viewer", profileId: "p1", signedIn: true };
    getProjectMembers.mockClear();

    const element = (await ProjectSettingsPage({ params: Promise.resolve({ projectCode: "PRJ-B" }) })) as unknown as { type: unknown };

    expect(element.type).toBe(AccessDenied);
    expect(getProjectMembers).not.toHaveBeenCalled();
  });
});
