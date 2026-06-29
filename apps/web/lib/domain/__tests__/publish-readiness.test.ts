import { describe, expect, it } from "vitest";
import { demoAssignment, demoKernel, demoMission, demoProject } from "@/lib/demo/demo-kernel";
import { canPublishProject, checkProjectPublishReadiness } from "../publish-readiness";

describe("publish readiness", () => {
  it("allows the demo project baseline to publish", () => {
    expect(canPublishProject({
      project: demoProject,
      operationDays: demoKernel.operationDays,
      missions: [demoMission],
      assignments: [demoAssignment]
    })).toBe(true);
  });

  it("blocks publish when no mission exists", () => {
    const readiness = checkProjectPublishReadiness({
      project: demoProject,
      operationDays: demoKernel.operationDays,
      missions: [],
      assignments: []
    });

    expect(readiness.canPublish).toBe(false);
    expect(readiness.blockers).toContain("At least one mission is required.");
  });
});

