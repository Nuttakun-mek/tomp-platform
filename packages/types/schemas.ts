import { z } from "zod";

const uuidSchema = z.string().uuid();
const optionalUuidSchema = uuidSchema.optional().nullable();
const metadataSchema = z.record(z.unknown()).default({});

export const createProjectSchema = z.object({
  organizationId: uuidSchema,
  ownerProfileId: optionalUuidSchema,
  projectCode: z.string().trim().min(2).max(40),
  projectName: z.string().trim().min(2).max(160),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  timezone: z.string().trim().min(1).default("Asia/Bangkok"),
  visibilityLevel: z.string().trim().min(1).default("internal"),
  serviceLevel: z.string().trim().min(1).default("standard"),
  metadata: metadataSchema
});

export const updateProjectSchema = createProjectSchema.partial();

export const createMissionSchema = z.object({
  projectId: uuidSchema,
  projectDayId: uuidSchema,
  sessionId: optionalUuidSchema,
  missionCode: z.string().trim().min(2).max(40),
  missionName: z.string().trim().min(2).max(160),
  missionType: z.string().trim().min(1).max(80),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  plannedStartTime: z.string().trim().optional().nullable(),
  plannedEndTime: z.string().trim().optional().nullable(),
  pickupVenueId: optionalUuidSchema,
  dropoffVenueId: optionalUuidSchema,
  instruction: z.string().trim().optional().nullable(),
  serviceCommitment: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export const updateMissionSchema = createMissionSchema.partial();

export const createAssignmentSchema = z.object({
  projectId: uuidSchema,
  missionId: uuidSchema,
  callSignId: uuidSchema,
  vehicleId: optionalUuidSchema,
  driverId: optionalUuidSchema,
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
  commitmentId: optionalUuidSchema,
  metadata: metadataSchema
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

export const createCallSignSchema = z.object({
  projectId: uuidSchema,
  callSign: z.string().trim().min(1).max(40),
  groupName: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export const createVehicleSchema = z.object({
  organizationId: optionalUuidSchema,
  vendorId: optionalUuidSchema,
  plateNumber: z.string().trim().min(1).max(40),
  vehicleType: z.string().trim().min(1).max(80),
  capacity: z.coerce.number().int().min(0).default(0),
  metadata: metadataSchema
});

export const createDriverSchema = z.object({
  organizationId: optionalUuidSchema,
  vendorId: optionalUuidSchema,
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(3).max(40),
  licenseType: z.string().trim().optional().nullable(),
  languages: z.array(z.string().trim()).default([]),
  metadata: metadataSchema
});

export const driverActivationSchema = z.object({
  assignmentId: uuidSchema,
  driverId: uuidSchema,
  confirmedName: z.boolean().default(false),
  confirmedPhone: z.boolean().default(false),
  confirmedVehicle: z.boolean().default(false),
  vehiclePhotoCaptured: z.boolean().default(false),
  platePhotoCaptured: z.boolean().default(false),
  gpsConsent: z.boolean().default(false)
});

export const vehicleCheckinSchema = z.object({
  projectId: uuidSchema,
  assignmentId: uuidSchema,
  vehicleId: uuidSchema,
  driverId: optionalUuidSchema,
  status: z.enum(["pending", "confirmed", "rejected"]).default("pending"),
  photoUrl: z.string().trim().url().optional().nullable(),
  platePhotoUrl: z.string().trim().url().optional().nullable(),
  metadata: metadataSchema
});

export const driverIssueReportSchema = z.object({
  projectId: uuidSchema,
  assignmentId: uuidSchema,
  driverId: optionalUuidSchema,
  issueType: z.string().trim().min(1).max(80),
  severity: z.enum(["info", "warning", "urgent"]).default("warning"),
  message: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export const driverCheckinSchema = z.object({
  projectId: uuidSchema,
  assignmentId: uuidSchema,
  driverId: uuidSchema,
  status: z.enum(["pending", "ready", "blocked"]).default("pending"),
  confirmedName: z.boolean().default(false),
  confirmedPhone: z.boolean().default(false),
  confirmedVehicle: z.boolean().default(false),
  gpsConsent: z.boolean().default(false),
  metadata: metadataSchema
});

export const assignmentStatusUpdateSchema = z.object({
  projectId: uuidSchema,
  assignmentId: uuidSchema,
  driverId: optionalUuidSchema,
  status: z.enum(["ready", "arrived_pickup", "passenger_onboard", "completed", "blocked"]),
  source: z.enum(["driver_qr", "operation_user", "coordinator", "system"]).default("driver_qr"),
  metadata: metadataSchema
});

export const publishProjectSchema = z.object({
  projectId: uuidSchema,
  reason: z.string().trim().min(2).max(500),
  snapshotData: z.record(z.unknown()).default({}),
  metadata: metadataSchema
});

export const createChangeRequestSchema = z.object({
  projectId: uuidSchema,
  objectType: z.string().trim().min(1).max(80),
  objectId: optionalUuidSchema,
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  reason: z.string().trim().min(2).max(1000),
  impactSummary: z.string().trim().optional().nullable(),
  beforeData: z.record(z.unknown()).optional().nullable(),
  afterData: z.record(z.unknown()).optional().nullable(),
  metadata: metadataSchema
});

export const approveChangeRequestSchema = z.object({
  changeRequestId: uuidSchema,
  projectId: uuidSchema,
  reason: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export const applyChangeRequestSchema = approveChangeRequestSchema.extend({
  afterData: z.record(z.unknown()).default({})
});

export const rejectChangeRequestSchema = approveChangeRequestSchema;

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type CreateCallSignInput = z.infer<typeof createCallSignSchema>;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type DriverActivationInput = z.infer<typeof driverActivationSchema>;
export type VehicleCheckinInput = z.infer<typeof vehicleCheckinSchema>;
export type DriverIssueReportInput = z.infer<typeof driverIssueReportSchema>;
export type DriverCheckinInput = z.infer<typeof driverCheckinSchema>;
export type AssignmentStatusUpdateInput = z.infer<typeof assignmentStatusUpdateSchema>;
export type PublishProjectInput = z.infer<typeof publishProjectSchema>;
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>;
export type ApproveChangeRequestInput = z.infer<typeof approveChangeRequestSchema>;
export type ApplyChangeRequestInput = z.infer<typeof applyChangeRequestSchema>;
export type RejectChangeRequestInput = z.infer<typeof rejectChangeRequestSchema>;
