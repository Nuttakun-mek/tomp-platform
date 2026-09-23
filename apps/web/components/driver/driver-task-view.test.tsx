// @vitest-environment jsdom
//
// The only test in this suite that needs a DOM. Everything else runs under the
// config's `node` default; the pragma above opts this one file out, because the
// behaviour under test — a useEffect-registered listener driving useState — only
// exists inside a real React render pass.
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
});
