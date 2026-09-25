// @vitest-environment jsdom
//
// The only test in this suite that needs a DOM. Everything else runs under the
// config's `node` default; the pragma above opts this one file out, because the
// behaviour under test — a useEffect-registered listener driving useState — only
// exists inside a real React render pass.
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { VIEW_SWITCH_EVENT, buildViewSwitchMessage } from "@tomp/driver-core";
import { DriverTaskView } from "./driver-task-view";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const NOW = "2026-09-23T01:00:00.000Z";

function baseRecord(id: string, metadata: Record<string, unknown> = {}) {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: null,
    updatedBy: null,
    archivedAt: null,
    deletedAt: null,
    metadata
  };
}

// Built field-by-field against the real DriverAccessAssignment in
// lib/data/driver-access.ts (and the BaseRecord-derived domain types it
// composes), not against the field names the component happens to read: a
// missing one would only show up as a render crash here.
function buildDriverAccess(): DriverAccessAssignment {
  return {
    token: "tomp_test_token",
    tokenId: "token-1",
    pinRequired: false,
    deviceBoundTo: null,
    tokenValidated: true,
    activated: true,
    project: {
      ...baseRecord("project-1"),
      organizationId: "org-1",
      ownerProfileId: null,
      projectCode: "PRJ-1",
      projectName: "โครงการทดสอบ",
      startDate: "2026-09-23",
      endDate: "2026-09-24",
      timezone: "Asia/Bangkok",
      status: "operating",
      visibilityLevel: "internal",
      serviceLevel: "standard"
    },
    assignment: {
      ...baseRecord("assignment-1", {
        pickupLocation: "สนามบินสุวรรณภูมิ",
        dropoffLocation: "โรงแรมทดสอบ",
        commitmentTime: "09:00"
      }),
      projectId: "project-1",
      missionId: "mission-1",
      callSignId: "call-sign-1",
      vehicleId: "vehicle-1",
      driverId: "driver-1",
      status: "acknowledged",
      startTime: NOW,
      endTime: null,
      commitmentId: null,
      currentVersion: 1
    },
    callSign: {
      ...baseRecord("call-sign-1"),
      projectId: "project-1",
      callSign: "A-01",
      groupName: null,
      driverId: "driver-1",
      vehicleId: "vehicle-1",
      status: "active"
    },
    driver: {
      ...baseRecord("driver-1"),
      organizationId: "org-1",
      vendorId: null,
      fullName: "สมชาย ทดสอบ",
      phone: "0800000000",
      licenseType: null,
      languages: [],
      status: "assigned"
    },
    vehicle: {
      ...baseRecord("vehicle-1"),
      organizationId: "org-1",
      vendorId: null,
      plateNumber: "1กก 1234",
      vehicleType: "รถตู้",
      capacity: 9,
      status: "assigned"
    },
    packet: null,
    notifications: [],
    routeChanges: [],
    messages: [],
    latestStatus: null,
    workSession: { status: "not_started", startedAt: null, endedAt: null, latestAt: null },
    dayAssignments: []
  };
}

describe("DriverTaskView view switching", () => {
  it("switches the visible section when the shell posts a view-switch event, with no navigation", () => {
    render(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);
    expect(screen.getByText("รายการปฏิบัติงาน")).toBeTruthy();

    // The shell dispatches this from injected JS, outside React's knowledge;
    // act() is only here so the resulting render is flushed before the assert.
    act(() => {
      window.dispatchEvent(new CustomEvent(VIEW_SWITCH_EVENT, { detail: buildViewSwitchMessage("next") }));
    });

    expect(screen.queryByText("รายการปฏิบัติงาน")).toBeNull();
    expect(screen.getByText("ลำดับงานที่ต้องดำเนินการถัดไป")).toBeTruthy();
  });

  it("follows a new `view` prop, which is how the browser-only fallback nav changes tabs", () => {
    // Outside the native shell the bottom nav is a <Link href="…&view=next">.
    // Next re-renders the server page with the new searchParam and hands this
    // same, still-mounted component a new `view` prop — it is never remounted.
    // State seeded once from the prop would ignore that and leave every button dead.
    const access = buildDriverAccess();
    const { rerender } = render(<DriverTaskView driverAccess={access} view="home" />);
    expect(screen.getByText("รายการปฏิบัติงาน")).toBeTruthy();

    rerender(<DriverTaskView driverAccess={access} view="next" />);

    expect(screen.queryByText("รายการปฏิบัติงาน")).toBeNull();
    expect(screen.getByText("ลำดับงานที่ต้องดำเนินการถัดไป")).toBeTruthy();
  });

  it("shows the browser-only fallback nav in a plain browser", () => {
    delete (window as { ReactNativeWebView?: unknown; TOMP_MOBILE_SHELL?: unknown }).ReactNativeWebView;
    delete (window as { ReactNativeWebView?: unknown; TOMP_MOBILE_SHELL?: unknown }).TOMP_MOBILE_SHELL;

    render(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);

    expect(screen.getByText(/เมนูนี้แสดงเฉพาะเมื่อเปิดหน้าคนขับผ่านเว็บเบราว์เซอร์/)).toBeTruthy();
  });

  it("hides the browser-only fallback nav inside the native WebView", () => {
    (window as { ReactNativeWebView?: unknown }).ReactNativeWebView = { postMessage: vi.fn() };
    try {
      render(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);

      expect(screen.queryByText(/เมนูนี้แสดงเฉพาะเมื่อเปิดหน้าคนขับผ่านเว็บเบราว์เซอร์/)).toBeNull();
    } finally {
      delete (window as { ReactNativeWebView?: unknown }).ReactNativeWebView;
    }
  });

  it("hydrates the server HTML inside the app without a mismatch", async () => {
    // The server cannot know about the app, so its HTML includes the browser nav.
    const html = renderToString(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    (window as { ReactNativeWebView?: unknown }).ReactNativeWebView = { postMessage: vi.fn() };
    const recoverable = vi.fn();
    try {
      await act(async () => {
        hydrateRoot(container, <DriverTaskView driverAccess={buildDriverAccess()} view="home" />, { onRecoverableError: recoverable });
      });
      expect(recoverable).not.toHaveBeenCalled();
      // …and the layout effect still removes the browser-only nav.
      expect(container.textContent).not.toMatch(/เมนูนี้แสดงเฉพาะเมื่อเปิดหน้าคนขับผ่านเว็บเบราว์เซอร์/);
    } finally {
      delete (window as { ReactNativeWebView?: unknown }).ReactNativeWebView;
      container.remove();
    }
  });

  function stubPoll(data: Record<string, unknown>) {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      headers: { get: () => null },
      json: async () => ({ success: true, data })
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const changedPickup = {
    pickupLocation: "ประตู 4 ผู้โดยสารขาเข้า",
    dropoffLocation: "โรงแรมใหม่",
    commitmentTime: "09:30"
  };

  it("shows a pickup the control room changed mid-job, taken from the periodic poll", async () => {
    // The page loads once per job now, so the current job's pickup, dropoff and
    // time can no longer ride in on a tab tap's page load. The 15s poll has to
    // carry them, or the driver keeps looking at the old pickup point.
    stubPoll({ assignmentId: "assignment-1", assignmentMetadata: changedPickup });
    try {
      render(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);
      expect(screen.getByText(/สนามบินสุวรรณภูมิ/)).toBeTruthy();

      expect(await screen.findByText(/ประตู 4 ผู้โดยสารขาเข้า/)).toBeTruthy();
      expect(screen.getByText(/โรงแรมใหม่/)).toBeTruthy();
      expect(screen.getByText(/09:30/)).toBeTruthy();
      expect(screen.queryByText(/สนามบินสุวรรณภูมิ/)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores poll details that belong to a different job", async () => {
    // The poll re-resolves the driver's current job each time. Once the next job
    // takes over, its details must not land on a page whose buttons still post
    // for the job it was loaded with.
    const fetchMock = stubPoll({ assignmentId: "assignment-2", assignmentMetadata: changedPickup });
    try {
      render(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.getByText(/สนามบินสุวรรณภูมิ/)).toBeTruthy();
      expect(screen.queryByText(/ประตู 4 ผู้โดยสารขาเข้า/)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the job's details when the poll could not read the job", async () => {
    // A missing row or a failed read comes back as null, not {}: an empty object
    // would blank the pickup, dropoff and coordinator phone mid-job.
    const fetchMock = stubPoll({ assignmentId: "assignment-1", assignmentMetadata: null });
    try {
      render(<DriverTaskView driverAccess={buildDriverAccess()} view="home" />);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.getByText(/สนามบินสุวรรณภูมิ/)).toBeTruthy();
      expect(screen.queryByText(/ยังไม่ระบุจุดรับ/)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a bridge-driven tab when the parent re-renders with the same `view` prop", () => {
    // Inside the shell the URL never changes after load, so the prop stays put
    // while the shell switches tabs over the bridge. An unrelated re-render must
    // not snap the page back to the URL's view.
    const access = buildDriverAccess();
    const { rerender } = render(<DriverTaskView driverAccess={access} view="home" />);

    act(() => {
      window.dispatchEvent(new CustomEvent(VIEW_SWITCH_EVENT, { detail: buildViewSwitchMessage("next") }));
    });
    rerender(<DriverTaskView driverAccess={access} view="home" />);

    expect(screen.getByText("ลำดับงานที่ต้องดำเนินการถัดไป")).toBeTruthy();
    expect(screen.queryByText("รายการปฏิบัติงาน")).toBeNull();
  });
});
