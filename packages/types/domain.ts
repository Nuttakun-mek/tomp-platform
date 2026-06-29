export type Id = string;

export type ProjectStatus = "draft" | "planning" | "published" | "operating" | "closing" | "closed" | "archived";
export type OperationDayStatus = "draft" | "ready" | "operating" | "closed" | "archived";
export type SessionStatus = "draft" | "ready" | "operating" | "closed" | "archived";
export type MissionPriority = "low" | "normal" | "high" | "critical";
export type MissionStatus = "draft" | "planned" | "published" | "active" | "completed" | "cancelled" | "archived";
export type AssignmentStatus = "draft" | "planned" | "published" | "active" | "completed" | "cancelled" | "archived";
export type TimelineSource = "system" | "operation_user" | "driver_qr" | "coordinator" | "organizer" | "import";
export type DriverActivationStatus = "pending" | "ready" | "blocked";
export type CheckinStatus = "pending" | "confirmed" | "rejected";
export type DriverIssueSeverity = "info" | "warning" | "urgent";
export type DriverLocationSource = "driver_web_app" | "operation_user" | "system" | "demo";
export type ReadinessStatus = "ready" | "warning" | "blocked";
export type OperationalRiskLevel = "low" | "medium" | "high";
export type PublishStatus = "draft" | "published" | "superseded" | "archived";
export type ChangeStatus = "requested" | "approved" | "applied" | "rejected" | "cancelled";
export type ChangeSeverity = "low" | "medium" | "high" | "critical";
export type ApprovalStatus = "pending" | "approved" | "rejected";

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
  ownerProfileId?: Id | null;
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

export interface DriverActivation {
  assignmentId: Id;
  driverId: Id;
  status: DriverActivationStatus;
  confirmedName: boolean;
  confirmedPhone: boolean;
  confirmedVehicle: boolean;
  vehiclePhotoCaptured: boolean;
  platePhotoCaptured: boolean;
  gpsConsent: boolean;
}

export interface VehicleCheckin {
  id: Id;
  projectId: Id;
  assignmentId: Id;
  vehicleId: Id;
  driverId?: Id | null;
  status: CheckinStatus;
  checkedAt?: string | null;
  photoUrl?: string | null;
  platePhotoUrl?: string | null;
  metadata: Record<string, unknown>;
}

export interface DriverIssueReport {
  projectId: Id;
  assignmentId: Id;
  driverId?: Id | null;
  issueType: string;
  severity: DriverIssueSeverity;
  message?: string | null;
  metadata: Record<string, unknown>;
}

export interface DriverLocation {
  id: Id;
  projectId: Id;
  assignmentId?: Id | null;
  driverId?: Id | null;
  vehicleId?: Id | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: string;
  source: DriverLocationSource;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ReadinessCheckItem {
  label: string;
  status: ReadinessStatus;
  required: boolean;
}

export interface DriverReadiness {
  driverId: Id;
  score: number;
  status: ReadinessStatus;
  checks: ReadinessCheckItem[];
}

export interface VehicleReadiness {
  vehicleId: Id;
  score: number;
  status: ReadinessStatus;
  checks: ReadinessCheckItem[];
}

export interface AssignmentReadiness {
  assignmentId: Id;
  status: ReadinessStatus;
  riskLevel: OperationalRiskLevel;
  missingItems: string[];
}

export interface Role extends BaseRecord {
  roleKey: string;
  roleName: string;
  description?: string | null;
}

export interface Permission extends BaseRecord {
  permissionKey: string;
  permissionName: string;
  description?: string | null;
}

export interface ProjectMember extends BaseRecord {
  projectId: Id;
  profileId: Id;
  roleId: Id;
  status: "active" | "inactive" | "invited" | "removed";
}

export interface PublishSnapshot {
  id: Id;
  projectId: Id;
  objectType: string;
  objectId?: Id | null;
  status: PublishStatus;
  reason?: string | null;
  snapshotData: Record<string, unknown>;
  createdBy?: Id | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ChangeRequest {
  id: Id;
  projectId: Id;
  objectType: string;
  objectId?: Id | null;
  status: ChangeStatus;
  severity: ChangeSeverity;
  reason: string;
  impactSummary?: string | null;
  requestedBy?: Id | null;
  approvedBy?: Id | null;
  appliedBy?: Id | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface ChangeImpact {
  id: Id;
  changeRequestId: Id;
  impactType: string;
  impactSummary: string;
  severity: ChangeSeverity;
  metadata: Record<string, unknown>;
}

export interface Approval {
  id: Id;
  projectId: Id;
  changeRequestId?: Id | null;
  status: ApprovalStatus;
  requestedBy?: Id | null;
  decidedBy?: Id | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}
