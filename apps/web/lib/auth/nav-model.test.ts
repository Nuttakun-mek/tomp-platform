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
    expect(hrefs).toContain("/projects");
    expect(hrefs).not.toContain("/superadmin");
    expect(hrefs).not.toContain("/portal");
  });

  it("wildcard permission unlocks everything", () => {
    const superAdmin = filterNav(NAV_SECTIONS, { permissions: ["*"], roleKeys: ["super_admin"] });
    expect(flat(superAdmin)).toContain("/superadmin");
    expect(flat(superAdmin)).toContain("/projects");
  });

  it("keeps the customer portal to the customer persona, even for super admins", () => {
    expect(flat(filterNav(NAV_SECTIONS, { permissions: ["*"], roleKeys: ["super_admin"] }))).not.toContain("/portal");
    expect(flat(filterNav(NAV_SECTIONS, { permissions: ["project.read"], roleKeys: ["customer_viewer"] }))).toContain("/portal");
  });

  it("hides project-gated nav from a viewer with no permissions", () => {
    const noPerm = filterNav(NAV_SECTIONS, { permissions: [], roleKeys: [] });
    expect(flat(noPerm)).not.toContain("/projects");
  });

  it("drops empty sections", () => {
    const noPerm = filterNav(NAV_SECTIONS, { permissions: [], roleKeys: [] });
    expect(noPerm.every((s) => s.items.length > 0)).toBe(true);
  });
});
