import { describe, expect, it } from "vitest";
import { estimateVehicleUsageCost } from "./vehicle-cost";

describe("estimateVehicleUsageCost", () => {
  it("prefers assignment time window over vehicle defaults", () => {
    const cost = estimateVehicleUsageCost({
      assignmentStart: "2026-09-20T08:00:00.000Z",
      assignmentEnd: "2026-09-20T11:30:00.000Z",
      vehicleMetadata: {
        defaultDutyStart: "07:00",
        defaultDutyEnd: "17:00",
        hourlyRate: 900,
        minimumHours: 2
      }
    });

    expect(cost.source).toBe("assignment_window");
    expect(cost.plannedHours).toBe(3.5);
    expect(cost.billableHours).toBe(3.5);
    expect(cost.estimatedCost).toBe(3150);
  });

  it("uses vehicle default duty window and minimum billable hours", () => {
    const cost = estimateVehicleUsageCost({
      vehicleMetadata: {
        defaultDutyStart: "22:00",
        defaultDutyEnd: "01:00",
        hourlyRate: 800,
        minimumHours: 4
      }
    });

    expect(cost.source).toBe("vehicle_default");
    expect(cost.plannedHours).toBe(3);
    expect(cost.billableHours).toBe(4);
    expect(cost.estimatedCost).toBe(3200);
  });

  it("keeps cost empty when either time or rate is missing", () => {
    const cost = estimateVehicleUsageCost({
      vehicleMetadata: {
        hourlyRate: 800
      }
    });

    expect(cost.source).toBe("missing");
    expect(cost.billableHours).toBeNull();
    expect(cost.estimatedCost).toBeNull();
  });
});
