import { describe, expect, it } from "vitest";
import { getCurrentDriverTask, getNextDriverAction, validateDriverAssignmentPacket } from "../assignment";

const packet = {
  id: "30000000-0000-4000-8000-000000000101",
  projectId: "30000000-0000-4000-8000-000000000001",
  assignmentId: "30000000-0000-4000-8000-000000000002",
  driverId: null,
  callSign: "A-01",
  status: "assigned",
  packetVersion: 1,
  projectName: "ทดสอบ",
  missionName: "รับส่ง",
  instructions: [
    { id: "30000000-0000-4000-8000-000000000201", title: "รับทราบงาน", status: "assigned", sequence: 1, required: true }
  ],
  routeInstruction: {
    routePlan: { summary: "จุดรับไปจุดส่ง", stops: [{ label: "จุดรับ" }, { label: "จุดส่ง" }], metadata: {} },
    pickup: { label: "จุดรับ" },
    dropoff: { label: "จุดส่ง" }
  },
  contactInstruction: { operationPhone: "0990000000" },
  safetyInstructions: [],
  metadata: {}
} as const;

describe("driver assignment packet", () => {
  it("gets current task", () => {
    expect(getCurrentDriverTask(packet)?.title).toBe("รับทราบงาน");
  });

  it("gets next action", () => {
    expect(getNextDriverAction("assigned")).toBe("กดรับทราบงาน");
  });

  it("validates packet", () => {
    expect(validateDriverAssignmentPacket(packet).success).toBe(true);
  });
});
