import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, filterNav } from "./nav-model";

const flat = (sections: ReturnType<typeof filterNav>) =>
  sections.flatMap((s) => s.items.map((i) => i.href));

describe("filterNav", () => {
  it("shows only items the viewer has permission/role for", () => {
    const dispatcher = filterNav(NAV_SECTIONS, {
      permissions: ["project.read", "assignment.read", "assignment.create", "driver.read", "vehicle.read"],
      roleKeys: ["dispatcher"]
    });
    const hrefs = flat(dispatcher);
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/assignments");
    expect(hrefs).toContain("/mission-control");
    expect(hrefs).not.toContain("/superadmin");
    expect(hrefs).not.toContain("/org/members");
  });

  it("wildcard permission unlocks everything", () => {
    const superAdmin = filterNav(NAV_SECTIONS, { permissions: ["*"], roleKeys: ["super_admin"] });
    expect(flat(superAdmin)).toContain("/superadmin");
    expect(flat(superAdmin)).toContain("/org/members");
  });

  it("always shows the overview to any logged-in viewer", () => {
    const noPerm = filterNav(NAV_SECTIONS, { permissions: [], roleKeys: [] });
    expect(flat(noPerm)).toEqual(["/"]);
  });

  it("drops empty sections", () => {
    const noPerm = filterNav(NAV_SECTIONS, { permissions: [], roleKeys: [] });
    expect(noPerm.every((s) => s.items.length > 0)).toBe(true);
  });
});
