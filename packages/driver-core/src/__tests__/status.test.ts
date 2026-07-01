import { describe, expect, it } from "vitest";
import { canDriverCompleteTask, canDriverStartTask, getAllowedDriverStatusTransitions, mapDriverStatusToThai } from "../status";

describe("driver status rules", () => {
  it("maps status to Thai", () => {
    expect(mapDriverStatusToThai("ready")).toBe("พร้อมเริ่มงาน");
  });

  it("allows expected transitions", () => {
    expect(getAllowedDriverStatusTransitions("arrived_pickup")).toContain("passenger_onboard");
  });

  it("checks start and complete capability", () => {
    expect(canDriverStartTask("acknowledged")).toBe(true);
    expect(canDriverCompleteTask("passenger_onboard")).toBe(true);
  });
});
