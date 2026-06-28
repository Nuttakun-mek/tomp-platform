export type Id = string;

export type ProjectStatus = "draft" | "planning" | "published" | "operating" | "closing" | "closed" | "archived";
export type OperationDayStatus = "draft" | "ready" | "operating" | "closed" | "archived";
export type SessionStatus = "draft" | "ready" | "operating" | "closed" | "archived";
export type MissionPriority = "low" | "normal" | "high" | "critical";
export type MissionStatus = "draft" | "planned" | "published" | "active" | "completed" | "cancelled" | "archived";
export type AssignmentStatus = "draft" | "planned" | "published" | "active" | "completed" | "cancelled" | "archived";
export type ResourceStatus = "available" | "assigned" | "inactive" | "out_of_service" | "archived";
export type TimelineSource = "system" | "operation_user" | "driver_qr" | "coordinator" | "organizer" | "import";

export interface BaseRecord {
  id: Id;
  createdAt: string;
  updatedAt: string;
  createdBy?: Id | null;
  updatedBy?: Id | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface Project extends BaseRecord {
  organizationId: Id;
  ownerUserId?: Id | null;
  projectCode: string;
  projectName: string;
  startDate: string;
  endDate: string;
  timezone: string;
  status: ProjectStatus;
  visibilityLevel: string;
  serviceLevel: string;
}

export interface OperationDay extends BaseRecord {
  projectId: Id;
  operationDate: string;
  dayNumber: number;
  timezone?: string | null;
  status: OperationDayStatus;
  briefingNotes?: string | null;
  closingNotes?: string | null;
}

export interface Session extends BaseRecord {
  projectId: Id;
  projectDayId: Id;
  sessionName: string;
  sessionType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status: SessionStatus;
}

export interface Mission extends BaseRecord {
  projectId: Id;
  projectDayId: Id;
  sessionId?: Id | null;
  missionCode: string;
  missionName: string;
  missionType: string;
  priority: MissionPriority;
  status: MissionStatus;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  pickupVenueId?: Id | null;
  dropoffVenueId?: Id | null;
  instruction?: string | null;
  serviceCommitment?: string | null;
}

export interface CallSign extends BaseRecord {
  projectId: Id;
  callSign: string;
  groupName?: string | null;
  status: "active" | "inactive" | "archived";
}

export interface Vehicle extends BaseRecord {
  organizationId?: Id | null;
  vendorId?: Id | null;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
  status: "available" | "assigned" | "out_of_service" | "archived";
}

export interface Driver extends BaseRecord {
  organizationId?: Id | null;
  vendorId?: Id | null;
  fullName: string;
  phone: string;
  licenseType?: string | null;
  languages: string[];
  status: "available" | "assigned" | "inactive" | "archived";
}

export interface Assignment extends BaseRecord {
  projectId: Id;
  missionId: Id;
  callSignId: Id;
  vehicleId?: Id | null;
  driverId?: Id | null;
  status: AssignmentStatus;
  startTime?: string | null;
  endTime?: string | null;
  commitmentId?: Id | null;
  currentVersion: number;
}

export interface AssignmentVersion {
  id: Id;
  assignmentId: Id;
  versionNumber: number;
  changeReason?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData: Record<string, unknown>;
  createdBy?: Id | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: Id;
  projectId: Id;
  objectType: string;
  objectId?: Id | null;
  eventType: string;
  actorId?: Id | null;
  source: TimelineSource;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}
