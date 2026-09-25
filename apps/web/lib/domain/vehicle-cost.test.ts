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
    // No clock-out yet, so this is the plan, not a finding that there was no OT.
    expect(vehicleUsageCostBreakdown(cost)).toContain("ประมาณการตามเวลาในแผน");
    expect(vehicleUsageCostBreakdown(cost)).not.toContain("ไม่เกินเวลาที่กำหนด");
  });

  it("says no overtime only once the real clock-in and clock-out are known", () => {
    const cost = estimateVehicleUsageCost({
      assignmentStart: "2026-09-20T08:00:00.000Z",
      assignmentEnd: "2026-09-20T18:00:00.000Z",
      actualStart: "2026-09-20T08:00:00.000Z",
      actualEnd: "2026-09-20T17:30:00.000Z",
      vehicleMetadata: { packageHours: 10, packageAmount: 3000 }
    });

    expect(cost.source).toBe("actual_session");
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

  it("warns once 80% of the planned window has passed, so there is time to call the driver", () => {
    const window = { assignmentStart: "2026-09-20T08:00:00.000Z", assignmentEnd: "2026-09-20T16:00:00.000Z", workSessionStatus: "active" };
    // 8 h window: 80% is 14:24, i.e. 96 minutes left.
    const before = evaluateVehicleServiceTimeAlert({ ...window, now: new Date("2026-09-20T14:20:00.000Z").getTime() });
    const after = evaluateVehicleServiceTimeAlert({ ...window, now: new Date("2026-09-20T14:25:00.000Z").getTime() });
    expect(before.tone).toBe("success");
    expect(after.tone).toBe("warning");
    expect(after.minutesRemaining).toBe(95);
  });

  it("falls back to warning 30 minutes before the end when the start is unknown", () => {
    const base = { assignmentEnd: "2026-09-20T16:00:00.000Z", workSessionStatus: "active" };
    expect(evaluateVehicleServiceTimeAlert({ ...base, now: new Date("2026-09-20T15:20:00.000Z").getTime() }).tone).toBe("success");
    expect(evaluateVehicleServiceTimeAlert({ ...base, now: new Date("2026-09-20T15:31:00.000Z").getTime() }).tone).toBe("warning");
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

  it("says the clock-out is missing, not overtime, when the job is done but the session is still open", () => {
    // The fleet card used to put "เกินเวลาบริการ" beside a cost line reading
    // "ไม่เกินเวลาที่กำหนด" for the same finished job: the session was simply
    // never clocked out. Name that, rather than an overtime that isn't known.
    const alert = evaluateVehicleServiceTimeAlert({
      assignmentEnd: "2026-09-20T18:00:00.000Z",
      workSessionStatus: "active",
      jobCompleted: true,
      now: new Date("2026-09-22T09:00:00.000Z").getTime()
    });

    expect(alert.tone).toBe("warning");
    expect(alert.label).toBe("ยังไม่บันทึกเวลาออก");
  });

  it("still flags overtime on a job that is running past its end", () => {
    const alert = evaluateVehicleServiceTimeAlert({
      assignmentEnd: "2026-09-20T18:00:00.000Z",
      workSessionStatus: "active",
      jobCompleted: false,
      now: new Date("2026-09-20T18:10:00.000Z").getTime()
    });

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
