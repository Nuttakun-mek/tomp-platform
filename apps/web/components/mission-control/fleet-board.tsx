import { AssignmentReadinessPanel } from "@/components/readiness/assignment-readiness-panel";
import { getAssignmentReadinessStatus, getMissingAssignmentData } from "@/lib/domain/assignment-rules";

export function FleetBoard() {
  const missingItems = getMissingAssignmentData({
    callSignId: "10000000-0000-4000-8000-000000000007",
    driverId: "10000000-0000-4000-8000-000000000009",
    vehicleId: null,
    startTime: "2026-07-15T01:30:00.000Z",
    endTime: "2026-07-15T02:30:00.000Z"
  });

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold text-ink">สถานะรถและคนขับ</h2>
      <AssignmentReadinessPanel
        readiness={{
          assignmentId: "10000000-0000-4000-8000-000000000010",
          status: getAssignmentReadinessStatus(missingItems),
          riskLevel: "medium",
          missingItems
        }}
      />
    </section>
  );
}
