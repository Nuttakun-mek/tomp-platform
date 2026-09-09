import type { Assignment, Mission, OperationDay, Project } from "@tomp/types/domain";
import { hasAssignmentTimeConflict } from "@/lib/domain/assignment-rules";

export interface PublishReadinessInput {
  project?: Project | null;
  operationDays: OperationDay[];
  missions: Mission[];
  assignments: Assignment[];
}

export interface PublishReadinessResult {
  canPublish: boolean;
  blockers: string[];
  warnings: string[];
}

export function getBlockingPublishIssues(input: PublishReadinessInput): string[] {
  const blockers: string[] = [];

  if (!input.project) blockers.push("ไม่พบข้อมูลโครงการ");
  if (input.operationDays.length === 0) blockers.push("ต้องมีวันปฏิบัติการอย่างน้อย 1 วัน");
  if (input.missions.length === 0) blockers.push("ต้องมีภารกิจอย่างน้อย 1 รายการ");

  input.missions.forEach((mission) => {
    if (!mission.plannedStartTime && !mission.serviceCommitment) {
      blockers.push(`ภารกิจ ${mission.missionCode} ต้องระบุเวลาเริ่มหรือข้อผูกพันด้านบริการ`);
    }
  });

  input.assignments.forEach((assignment) => {
    if (!assignment.callSignId) blockers.push(`งาน ${assignment.id.slice(0, 8)} ยังไม่ได้กำหนด Call Sign`);
  });

  return blockers;
}

export function getPublishWarnings(input: PublishReadinessInput): string[] {
  const warnings: string[] = [];

  input.assignments.forEach((assignment) => {
    if (!assignment.driverId) warnings.push(`Assignment ${assignment.id} has driver pending.`);
    if (!assignment.vehicleId) warnings.push(`Assignment ${assignment.id} has vehicle pending.`);
  });

  input.assignments.forEach((assignment) => {
    if (hasAssignmentTimeConflict(assignment, input.assignments)) {
      warnings.push(`Assignment ${assignment.id} has an obvious driver or vehicle time conflict.`);
    }
  });

  return warnings;
}

export function checkProjectPublishReadiness(input: PublishReadinessInput): PublishReadinessResult {
  const blockers = getBlockingPublishIssues(input);
  const warnings = getPublishWarnings(input);

  return {
    canPublish: blockers.length === 0,
    blockers,
    warnings
  };
}

export function canPublishProject(input: PublishReadinessInput): boolean {
  return checkProjectPublishReadiness(input).canPublish;
}

