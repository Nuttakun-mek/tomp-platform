import { describe, expect, it } from "vitest";
import { buildFleetViewFromRows } from "./fleet-view";

const now = new Date("2026-09-11T10:00:00.000Z").getTime();

function token(overrides = {}) {
  return {
    id: "token-1",
    projectId: "project-1",
    scope: "project",
    callSignIds: null,
    showCrew: false,
    pinHash: null,
    expiresAt: "2026-09-12T00:00:00.000Z",
    label: null,
    ...overrides
  };
}

const callSigns = [
  { id: "cs-1", projectId: "project-1", callSign: "A-01", driverId: "d-1", vehicleId: "v-1", status: "active", groupName: null, createdAt: "", updatedAt: "", metadata: {} },
  { id: "cs-2", projectId: "project-1", callSign: "A-02", driverId: "d-2", vehicleId: "v-2", status: "active", groupName: null, createdAt: "", updatedAt: "", metadata: {} }
] as const;

const vehicles = [
  { id: "v-1", plateNumber: "กก 1001", vehicleType: "รถตู้", capacity: 10, status: "assigned", organizationId: null, vendorId: null, createdAt: "", updatedAt: "", metadata: { colour: "ขาว" } },
  { id: "v-2", plateNumber: "กก 1002", vehicleType: "รถตู้", capacity: 10, status: "assigned", organizationId: null, vendorId: null, createdAt: "", updatedAt: "", metadata: {} }
] as const;

const assignments = [
  { id: "a-1", projectId: "project-1", missionId: "m-1", callSignId: "cs-1", vehicleId: "v-1", driverId: "d-1", status: "active", startTime: "2026-09-11T09:00:00.000Z", endTime: null, commitmentId: null, currentVersion: 1, createdAt: "", updatedAt: "", metadata: { dropoffLocation: "ศูนย์ประชุม" } },
  { id: "a-2", projectId: "project-1", missionId: "m-1", callSignId: "cs-2", vehicleId: "v-2", driverId: "d-2", status: "planned", startTime: "2026-09-11T11:00:00.000Z", endTime: null, commitmentId: null, currentVersion: 1, createdAt: "", updatedAt: "", metadata: { dropoffLocation: "โรงแรม" } }
] as const;

const locationsByCallSign = {
  "cs-1": {
    latitude: 13.75,
    longitude: 100.5,
    accuracy: 8,
    recordedAt: "2026-09-11T09:59:45.000Z",
    sharingEvent: "location_ping",
    metadata: {}
  }
} as const;

function hasKeyDeep(value: unknown, key: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some((child) => hasKeyDeep(child, key));
}

describe("fleet view builder", () => {
  it("returns every active unit for a project-scoped token", () => {
    const view = buildFleetViewFromRows({
      token: token(),
      project: { id: "project-1", projectName: "งานทดสอบ", projectCode: "P-001" },
      callSigns: [...callSigns],
      vehicles: [...vehicles],
      assignments: [...assignments],
      locationsByCallSign: { ...locationsByCallSign },
      now
    });

    expect(view?.units.map((unit) => unit.callSign)).toEqual(["A-01", "A-02"]);
  });

  it("restricts units when callSignIds are set", () => {
    const view = buildFleetViewFromRows({
      token: token({ callSignIds: ["cs-2"] }),
      project: { id: "project-1", projectName: "งานทดสอบ", projectCode: "P-001" },
      callSigns: [...callSigns],
      vehicles: [...vehicles],
      assignments: [...assignments],
      locationsByCallSign: { ...locationsByCallSign },
      now
    });

    expect(view?.units.map((unit) => unit.callSign)).toEqual(["A-02"]);
  });

  it("rejects call-sign-scoped and expired tokens", () => {
    const base = {
      project: { id: "project-1", projectName: "งานทดสอบ", projectCode: "P-001" },
      callSigns: [...callSigns],
      vehicles: [...vehicles],
      assignments: [...assignments],
      locationsByCallSign: { ...locationsByCallSign },
      now
    };

    expect(buildFleetViewFromRows({ token: token({ scope: "call_sign" }), ...base })).toBeNull();
    expect(buildFleetViewFromRows({ token: token({ expiresAt: "2026-09-10T00:00:00.000Z" }), ...base })).toBeNull();
  });

  it("hides driver names by default and never returns phone fields", () => {
    const view = buildFleetViewFromRows({
      token: token({ showCrew: false }),
      project: { id: "project-1", projectName: "งานทดสอบ", projectCode: "P-001" },
      callSigns: [...callSigns],
      vehicles: [...vehicles],
      assignments: [...assignments],
      drivers: [{ id: "d-1", fullName: "สมชาย" }],
      locationsByCallSign: { ...locationsByCallSign },
      now
    });

    expect(view?.units[0]?.driverName).toBeNull();
    expect(hasKeyDeep(view, "phone")).toBe(false);
  });

  it("can show driver names when explicitly enabled", () => {
    const view = buildFleetViewFromRows({
      token: token({ showCrew: true }),
      project: { id: "project-1", projectName: "งานทดสอบ", projectCode: "P-001" },
      callSigns: [...callSigns],
      vehicles: [...vehicles],
      assignments: [...assignments],
      drivers: [{ id: "d-1", fullName: "สมชาย" }],
      locationsByCallSign: { ...locationsByCallSign },
      now
    });

    expect(view?.units[0]?.driverName).toBe("สมชาย");
  });
});
