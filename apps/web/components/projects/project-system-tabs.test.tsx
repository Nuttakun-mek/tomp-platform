// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let pathname = "/projects/EVT/airport-transfer";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { ProjectSystemTabs } = await import("./project-system-tabs");

afterEach(cleanup);

describe("ProjectSystemTabs", () => {
  it("shows no Ground Transfer tab on a project that only uses Airport Transfer", () => {
    render(<ProjectSystemTabs projectCode="EVT" enabledSystems={["airport_transfer"]} viewerSystems={["airport_transfer"]} active="airport_transfer" />);
    expect(screen.queryByText("Ground Transfer")).toBeNull();
    expect(screen.getByText("Airport Transfer")).toBeTruthy();
  });

  it("gives Airport Transfer its sections, including the Excel import", () => {
    pathname = "/projects/EVT/airport-transfer/imports/123";
    render(<ProjectSystemTabs projectCode="EVT" enabledSystems={["airport_transfer"]} viewerSystems={["airport_transfer"]} active="airport_transfer" />);
    const imports = screen.getByRole("link", { name: /นำเข้า Excel/ });
    expect(imports.getAttribute("href")).toBe("/projects/EVT/airport-transfer/imports");
    expect(imports.getAttribute("aria-current")).toBe("page");
  });

  it("still marks a system the viewer cannot enter as locked", () => {
    pathname = "/projects/EVT/ground-transfer";
    render(<ProjectSystemTabs projectCode="EVT" enabledSystems={["ground_transfer", "airport_transfer"]} viewerSystems={["ground_transfer"]} active="ground_transfer" />);
    expect(screen.getByText("Airport Transfer").closest("[aria-disabled]")).toBeTruthy();
  });
});
