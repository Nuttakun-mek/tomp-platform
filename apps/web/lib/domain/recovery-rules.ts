import type { DriverIssueType, IncidentSeverity, RecoveryActionType, RecoveryRecommendation } from "@tomp/types/domain";

const recoveryActionsByIssue: Record<DriverIssueType, RecoveryActionType[]> = {
  delay: ["contact_driver", "contact_coordinator", "monitor"],
  vehicle: ["contact_driver", "replace_vehicle", "notify_organizer"],
  passenger: ["contact_coordinator", "notify_organizer", "monitor"],
  route: ["contact_driver", "change_assignment", "monitor"],
  safety: ["contact_driver", "contact_coordinator", "notify_organizer"],
  other: ["contact_driver", "monitor"]
};

export function getIncidentRiskLabel(severity: IncidentSeverity) {
  if (severity === "critical") return "วิกฤต";
  if (severity === "urgent") return "เร่งด่วน";
  if (severity === "warning") return "ต้องติดตาม";
  return "ข้อมูล";
}

export function shouldEscalateIncident(severity: IncidentSeverity, minutesOpen: number) {
  if (severity === "critical") return true;
  if (severity === "urgent" && minutesOpen >= 5) return true;
  return severity === "warning" && minutesOpen >= 15;
}

export function buildRecoveryRecommendation(input: {
  issueType: DriverIssueType;
  severity: IncidentSeverity;
  minutesOpen?: number;
}): RecoveryRecommendation {
  const baseActions = recoveryActionsByIssue[input.issueType] ?? recoveryActionsByIssue.other;
  const escalate = shouldEscalateIncident(input.severity, input.minutesOpen ?? 0);
  const actions: RecoveryActionType[] = escalate && !baseActions.includes("notify_organizer") ? [...baseActions, "notify_organizer"] : baseActions;

  return {
    severity: input.severity,
    riskLabel: getIncidentRiskLabel(input.severity),
    actions,
    operatorMessage: escalate
      ? "ควรยกระดับให้ศูนย์ควบคุมติดตามทันที และแจ้งผู้เกี่ยวข้องตามผลกระทบ"
      : "ให้ผู้รับผิดชอบติดต่อคนขับหรือผู้ประสานงาน แล้วติดตามสถานะใน Timeline",
    driverMessage: input.severity === "critical" ? "กรุณาหยุดดำเนินงานในจุดที่ปลอดภัยและติดต่อศูนย์ควบคุมทันที" : null
  };
}

export function mapRecoveryActionToThai(action: RecoveryActionType) {
  const labels: Record<RecoveryActionType, string> = {
    contact_driver: "ติดต่อคนขับ",
    contact_coordinator: "ติดต่อผู้ประสานงาน",
    replace_driver: "เปลี่ยนคนขับ",
    replace_vehicle: "เปลี่ยนรถ",
    change_assignment: "ปรับ Assignment",
    notify_organizer: "แจ้งผู้จัดงาน",
    monitor: "ติดตามต่อ"
  };
  return labels[action];
}
