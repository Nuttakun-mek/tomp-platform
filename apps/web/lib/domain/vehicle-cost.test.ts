import { describe, expect, it } from "vitest";
import { estimateVehicleUsageCost, evaluateVehicleServiceTimeAlert, vehicleUsageCostBreakdown } from "./vehicle-cost";

describe("estimateVehicleUsageCost", () => {
  it("prefers assignment time window over vehicle defaults", () => {
    const cost = estimateVehicleUsageCost({
      assignmentStart: "2026-09-20T08:00:00.000Z",
      assignmentEnd: "2026-09-20T11:30:00.000Z",
      vehicleMetadata: {
        defaultDutyStart: "07:00",
        defaultDutyEnd: "17:00",
        packageHours: 3.5,
        packageAmount: 3150
      }
    });

    expect(cost.source).toBe("assignment_window");
    expect(cost.plannedHours).toBe(3.5);
    expect(cost.countedHours).toBe(3.5);
    expect(cost.includedHours).toBe(3.5);
    expect(cost.extraHours).toBe(0);
    expect(cost.billableHours).toBe(3.5);
    expect(cost.packageHours).toBe(3.5);
    expect(cost.packageAmount).toBe(3150);
    expect(cost.hourlyRate).toBe(900);
    expect(cost.baseAmount).toBe(3150);
    expect(cost.extraAmount).toBe(0);
    expect(cost.estimatedCost).toBe(3150);
    expect(vehicleUsageCostBreakdown(cost)).toContain("ไม่เกินเวลาที่กำหนด");
  });

  it("does not count early driver clock-in before the planned start but counts overtime after the planned end", () => {
    const cost = estimateVehicleUsageCost({
      assignmentStart: "2026-09-20T08:00:00.000Z",
      assignmentEnd: "2026-09-20T18:00:00.000Z",
      actualStart: "2026-09-20T07:20:00.000Z",
      actualEnd: "2026-09-20T19:15:00.000Z",
      vehicleMetadata: {
        packageHours: 10,
        packageAmount: 3000
      }
    });

    expect(cost.source).toBe("actual_session");
    expect(cost.plannedHours).toBe(10);
    expect(cost.countedHours).toBe(11.25);
    expect(cost.includedHours).toBe(10);
    expect(cost.extraHours).toBe(1.25);
    expect(cost.hourlyRate).toBe(300);
    expect(cost.estimatedCost).toBe(3375);
    expect(vehicleUsageCostBreakdown(cost)).toContain("มีค่าล่วงเวลา (OT) 1.25 ชม.");
  });

  it("uses vehicle default duty window and package hours", () => {
    const cost = estimateVehicleUsageCost({
      vehicleMetadata: {
        defaultDutyStart: "22:00",
        defaultDutyEnd: "01:00",
        packageHours: 4,
        packageAmount: 3200
      }
    });

    expect(cost.source).toBe("vehicle_default");
    expect(cost.plannedHours).toBe(3);
    expect(cost.includedHours).toBe(4);
    expect(cost.extraHours).toBe(0);
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

describe("evaluateVehicleServiceTimeAlert", () => {
  it("warns before the service window is about to end", () => {
    const alert = evaluateVehicleServiceTimeAlert({
      assignmentEnd: "2026-09-20T18:00:00.000Z",
      workSessionStatus: "active",
      now: new Date("2026-09-20T17:40:00.000Z").getTime()
    });

    expect(alert.tone).toBe("warning");
    expect(alert.label).toBe("ใกล้ครบเวลาบริการ");
  });

  it("marks active sessions as overtime after the planned end", () => {
    const alert = evaluateVehicleServiceTimeAlert({
      assignmentEnd: "2026-09-20T18:00:00.000Z",
      workSessionStatus: "active",
      now: new Date("2026-09-20T18:10:00.000Z").getTime()
    });

    expect(alert.tone).toBe("danger");
    expect(alert.label).toBe("เกินเวลาบริการ");
  });

  it("keeps completed sessions clear when there is no overtime", () => {
    const alert = evaluateVehicleServiceTimeAlert({
      workSessionStatus: "ended",
      extraHours: 0
    });

    expect(alert.tone).toBe("success");
    expect(alert.label).toBe("ปิดเวลาบริการแล้ว");
  });
});
