// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION, MOBILE_SHELL_READY_EVENT } from "@tomp/driver-core";
import { DriverLeaveJobButton } from "./driver-leave-job-button";

afterEach(() => {
  cleanup();
  delete (window as { TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL;
});

function installShell() {
  const postMessage = vi.fn();
  (window as { TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL = { namespace: BRIDGE_NAMESPACE, version: BRIDGE_VERSION, postMessage };
  return postMessage;
}

describe("DriverLeaveJobButton", () => {
  it("renders nothing in a plain browser", () => {
    const { container } = render(<DriverLeaveJobButton />);
    expect(container.innerHTML).toBe("");
  });

  it("asks the app to leave the job when tapped", () => {
    const postMessage = installShell();
    render(<DriverLeaveJobButton />);
    fireEvent.click(screen.getByRole("button", { name: /สแกน QR ใหม่/ }));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "job.leave", payload: { reason: "link_not_found" } }));
  });

  it("appears when the app injects its handle after the page has loaded", () => {
    render(<DriverLeaveJobButton />);
    expect(screen.queryByRole("button")).toBeNull();
    installShell();
    act(() => {
      window.dispatchEvent(new Event(MOBILE_SHELL_READY_EVENT));
    });
    expect(screen.getByRole("button", { name: /สแกน QR ใหม่/ })).toBeTruthy();
  });
});
