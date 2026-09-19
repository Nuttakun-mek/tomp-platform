import { describe, expect, it, vi } from "vitest";

// Regression test: the outer project tab bar (this layout) checked
// getViewerSystemKeys() unconditionally, with no super_admin bypass — unlike
// the landing page ((app)/page.tsx), which correctly treats super_admin as
// unlocked for every system. Result: a super_admin with no explicit
// project_members row for airport_transfer on THIS specific project saw the
// Airport Transfer tab rendered as locked placeholder text, not a clickable
// link — reported in production as "selecting Airport Transfer doesn't work,
// whether at project creation or after enabling it in Settings." Both
// symptoms trace back to this one layout, since every route under
// /projects/[projectCode]/** renders through it.

const project = {
  id: "project-a",
  organizationId: "org-1",
  projectCode: "PRJ-A",
  projectName: "Project A",
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

let viewerAccessResult: { roleKeys: string[] } = { roleKeys: [] };
const getViewerAccess = vi.fn(async () => viewerAccessResult);
vi.mock("@/lib/auth/access", () => ({ getViewerAccess: () => getViewerAccess() }));

vi.mock("@/lib/data/projects", () => ({ getProjectByCode: vi.fn(async () => project) }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserProfile: vi.fn(async () => ({ id: "profile-1" })) }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- rest param exists only to type .mock.calls/toHaveBeenCalledWith below.
const getViewerSystemKeys = vi.fn(async (..._args: unknown[]) => ["ground_transfer"]);
vi.mock("@/lib/data/project-systems", () => ({
  getEnabledSystemKeys: vi.fn(async () => ["ground_transfer", "airport_transfer"]),
  getViewerSystemKeys: (...args: unknown[]) => getViewerSystemKeys(...args)
}));

import { ProjectSystemTabs } from "@/components/projects/project-system-tabs";
import ProjectShellLayout from "./layout";

function tabsProps(element: { props: { children: unknown[] } }) {
  const tabs = element.props.children[0] as { type: unknown; props: { viewerSystems: string[] } };
  expect(tabs.type).toBe(ProjectSystemTabs);
  return tabs.props;
}

describe("ProjectShellLayout system-tab visibility", () => {
  it("gives super_admin every system unlocked without querying project_members, even with none on this project", async () => {
    viewerAccessResult = { roleKeys: ["super_admin"] };
    getViewerSystemKeys.mockClear();

    const element = (await ProjectShellLayout({
      params: Promise.resolve({ projectCode: "PRJ-A" }),
      children: null
    })) as unknown as { props: { children: unknown[] } };

    const props = tabsProps(element);
    expect(props.viewerSystems).toEqual(["ground_transfer", "airport_transfer"]);
    expect(getViewerSystemKeys).not.toHaveBeenCalled();
  });

  it("falls back to the real project_members lookup for a non-super_admin viewer", async () => {
    viewerAccessResult = { roleKeys: ["project_manager"] };
    getViewerSystemKeys.mockClear();
    getViewerSystemKeys.mockResolvedValueOnce(["ground_transfer"]);

    const element = (await ProjectShellLayout({
      params: Promise.resolve({ projectCode: "PRJ-A" }),
      children: null
    })) as unknown as { props: { children: unknown[] } };

    const props = tabsProps(element);
    expect(props.viewerSystems).toEqual(["ground_transfer"]);
    expect(getViewerSystemKeys).toHaveBeenCalledWith("profile-1");
  });
});
