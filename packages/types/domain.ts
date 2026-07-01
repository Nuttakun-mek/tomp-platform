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
export type DriverIssueSeverity = "info" | "warning" | "urgent" | "critical";
export type DriverLocationSource = "driver_web_app" | "operation_user" | "system" | "demo";
export type ReadinessStatus = "ready" | "warning" | "blocked";
export type OperationalRiskLevel = "low" | "medium" | "high";
export type PublishStatus = "draft" | "published" | "superseded" | "archived";
export type ChangeStatus = "requested" | "approved" | "applied" | "rejected" | "cancelled";
export type ChangeSeverity = "low" | "medium" | "high" | "critical";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type DriverTaskStatus =
  | "assigned"
  | "acknowledged"
  | "ready"
  | "en_route_pickup"
  | "arrived_pickup"
  | "passenger_onboard"
  | "en_route_dropoff"
  | "completed"
  | "blocked"
  | "cancelled";
export type DriverReadinessStatus = "not_ready" | "ready" | "blocked";
export type DriverLocationStatus = "offline" | "healthy" | "weak" | "stale";
export type DriverAppConnectionStatus = "unknown" | "online" | "background" | "offline";
export type DriverNotificationPriority = "low" | "normal" | "high" | "critical";
export type DriverNotificationAction = "acknowledge" | "call_control" | "open_maps" | "report_issue" | "none";
export type DriverIssueType = "delay" | "vehicle" | "passenger" | "route" | "safety" | "other";

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
  sharingEvent?: "sharing_started" | "location_ping" | "sharing_stopped";
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

export interface RouteStop {
  id?: Id;
  label: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  plannedTime?: string | null;
  notes?: string | null;
}

export interface RoutePlan {
  id?: Id;
  summary: string;
  stops: RouteStop[];
  googleMapsUrl?: string | null;
  metadata: Record<string, unknown>;
}

export interface DriverRouteInstruction {
  routePlan: RoutePlan;
  pickup: RouteStop;
  dropoff: RouteStop;
  note?: string | null;
}

export interface DriverContactInstruction {
  coordinatorPhone?: string | null;
  operationPhone?: string | null;
  note?: string | null;
}

export interface DriverSafetyInstruction {
  message: string;
  required: boolean;
}

export interface DriverPickupInstruction {
  location: RouteStop;
  serviceNote?: string | null;
}

export interface DriverDropoffInstruction {
  location: RouteStop;
  serviceNote?: string | null;
}

export interface DriverAssignmentInstruction {
  id: Id;
  title: string;
  status: DriverTaskStatus;
  sequence: number;
  required: boolean;
}

export interface DriverAssignmentPacket {
  id: Id;
  projectId: Id;
  assignmentId: Id;
  driverId?: Id | null;
  callSign: string;
  status: DriverTaskStatus;
  packetVersion: number;
  projectName: string;
  missionName?: string | null;
  instructions: DriverAssignmentInstruction[];
  routeInstruction: DriverRouteInstruction;
  contactInstruction: DriverContactInstruction;
  safetyInstructions: DriverSafetyInstruction[];
  publishedAt?: string | null;
  acknowledgedAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface RouteChangeRequest {
  id: Id;
  projectId: Id;
  assignmentId: Id;
  reason: string;
  status: ChangeStatus;
  oldRoute?: RoutePlan | null;
  newRoute: RoutePlan;
  metadata: Record<string, unknown>;
}

export interface RouteChangeInstruction {
  id: Id;
  assignmentId: Id;
  reason: string;
  impactSummary?: string | null;
  oldRoute?: RoutePlan | null;
  newRoute: RoutePlan;
  status: "pending" | "acknowledged" | "applied" | "cancelled";
}

export interface RouteDeviationWarning {
  assignmentId: Id;
  severity: "watch" | "warning" | "critical";
  message: string;
  detectedAt: string;
}

export interface DriverNotification {
  id: Id;
  projectId: Id;
  assignmentId?: Id | null;
  driverId?: Id | null;
  notificationType: string;
  priority: DriverNotificationPriority;
  title: string;
  body: string;
  action: DriverNotificationAction;
  actionLabel?: string | null;
  actionUrl?: string | null;
  status: "unread" | "read" | "actioned" | "expired";
  createdAt: string;
  expiresAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface DriverContactCard {
  name: string;
  role: "coordinator" | "operation" | "organizer" | "emergency";
  phone: string;
  primary: boolean;
}

export interface DriverEscalationContact extends DriverContactCard {
  level: number;
  escalationReason?: string | null;
}

export interface DriverAssistanceRequest {
  id: Id;
  projectId: Id;
  assignmentId: Id;
  driverId?: Id | null;
  issueType: DriverIssueType;
  severity: DriverIssueSeverity;
  message: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface DriverLocationPing {
  projectId: Id;
  assignmentId: Id;
  driverId?: Id | null;
  vehicleId?: Id | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: string;
  source: DriverLocationSource;
  metadata: Record<string, unknown>;
}

export interface DriverLocationConsent {
  driverId?: Id | null;
  assignmentId: Id;
  consentGivenAt: string;
  consentTextVersion: string;
}

export interface DriverLocationSession {
  id: Id;
  projectId: Id;
  assignmentId: Id;
  driverId?: Id | null;
  vehicleId?: Id | null;
  status: DriverLocationStatus;
  startedAt: string;
  stoppedAt?: string | null;
  lastPingAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface DriverLocationHealth {
  status: DriverLocationStatus;
  message: string;
  stale: boolean;
  lastPingAt?: string | null;
}

export interface DriverEvidencePhoto {
  id?: Id;
  projectId: Id;
  assignmentId: Id;
  driverId?: Id | null;
  photoType: "vehicle" | "plate" | "pickup_proof" | "completion_proof";
  storagePath: string;
  capturedAt: string;
  metadata: Record<string, unknown>;
}

export interface VehiclePhotoEvidence extends DriverEvidencePhoto {
  photoType: "vehicle";
}

export interface PlatePhotoEvidence extends DriverEvidencePhoto {
  photoType: "plate";
}

export interface PickupProof extends DriverEvidencePhoto {
  photoType: "pickup_proof";
}

export interface CompletionProof extends DriverEvidencePhoto {
  photoType: "completion_proof";
}
