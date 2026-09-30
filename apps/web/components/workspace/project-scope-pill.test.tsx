// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let pathname = "/projects";
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push, refresh }) }));

const { ProjectScopePill } = await import("./project-scope-pill");

const projects = [
  { id: "a", projectCode: "TOMP-A", projectName: "Alpha" },
  { id: "b", projectCode: "TOMP-B", projectName: "Beta" }
];

afterEach(() => {
  cleanup();
  push.mockClear();
  refresh.mockClear();
  document.cookie = "tomp_scope=; max-age=0; path=/";
});

describe("ProjectScopePill", () => {
  it("shows the project the URL is in, not the last one picked here", () => {
    pathname = "/projects/TOMP-B/ground-transfer/control";
    render(<ProjectScopePill projects={projects} activeId="a" />);
    expect(screen.getByText(/TOMP-B/)).toBeTruthy();
    expect(document.cookie).toContain("tomp_scope=b");
  });

  it("inside a project, picking another one goes to it", () => {
    pathname = "/projects/TOMP-A/ground-transfer";
    render(<ProjectScopePill projects={projects} activeId="a" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByText(/Beta/));
    expect(push).toHaveBeenCalledWith("/projects/TOMP-B");
  });

  it("outside a project, it only changes the remembered project", () => {
    pathname = "/projects";
    render(<ProjectScopePill projects={projects} activeId="a" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByText(/Beta/));
    expect(push).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });
});
