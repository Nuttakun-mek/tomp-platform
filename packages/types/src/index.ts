export type ProjectId = string;
export type MissionId = string;
export type AssignmentId = string;
export type DriverId = string;
export type VehicleId = string;

export type PlanStatus = "draft" | "published" | "archived";

export interface Project {
  id: ProjectId;
  name: string;
  status: PlanStatus;
  startsAt: string;
  endsAt: string;
}

export interface Mission {
  id: MissionId;
  projectId: ProjectId;
  name: string;
  origin?: string;
  destination?: string;
  serviceWindowStart: string;
  serviceWindowEnd: string;
}

export interface Assignment {
  id: AssignmentId;
  projectId: ProjectId;
  missionId: MissionId;
  driverId: DriverId;
  vehicleId: VehicleId;
  callSign: string;
  startsAt: string;
  endsAt: string;
}

export interface ChangeEvent {
  id: string;
  projectId: ProjectId;
  assignmentId?: AssignmentId;
  occurredAt: string;
  actorId: string;
  summary: string;
  reason?: string;
}
