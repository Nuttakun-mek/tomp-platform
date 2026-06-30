import type { Assignment } from "@tomp/types/domain";
import { RiskBadge } from "@/components/ui/risk-badge";

export function AssignmentRiskBadge({ assignment }: { assignment: Assignment }) {
  if (!assignment.driverId || !assignment.vehicleId || !assignment.callSignId) return <RiskBadge level="medium" />;
  if (!assignment.startTime || !assignment.endTime) return <RiskBadge level="high" />;
  return <RiskBadge level="low" />;
}
