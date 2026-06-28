import { z } from "zod";

const uuidSchema = z.string().uuid();
const optionalUuidSchema = uuidSchema.optional().nullable();
const metadataSchema = z.record(z.unknown()).default({});

export const projectCreateSchema = z.object({
  organizationId: uuidSchema,
  ownerUserId: optionalUuidSchema,
  projectCode: z.string().trim().min(2).max(40),
  projectName: z.string().trim().min(2).max(160),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  timezone: z.string().trim().min(1).default("Asia/Bangkok"),
  visibilityLevel: z.string().trim().min(1).default("internal"),
  serviceLevel: z.string().trim().min(1).default("standard"),
  metadata: metadataSchema
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const operationDayCreateSchema = z.object({
  projectId: uuidSchema,
  operationDate: z.string().trim().min(1),
  dayNumber: z.coerce.number().int().positive(),
  timezone: z.string().trim().optional().nullable(),
  briefingNotes: z.string().trim().optional().nullable(),
  closingNotes: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export const operationDayUpdateSchema = operationDayCreateSchema.partial();

export const sessionCreateSchema = z.object({
  projectId: uuidSchema,
  projectDayId: uuidSchema,
  sessionName: z.string().trim().min(2).max(120),
  sessionType: z.string().trim().optional().nullable(),
  startTime: z.string().trim().optional().nullable(),
  endTime: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export const sessionUpdateSchema = sessionCreateSchema.partial();

export const missionCreateSchema = z.object({
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

export const missionUpdateSchema = missionCreateSchema.partial();

export const assignmentCreateSchema = z.object({
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

export const assignmentUpdateSchema = assignmentCreateSchema.partial();

export const callSignCreateSchema = z.object({
  projectId: uuidSchema,
  callSign: z.string().trim().min(1).max(40),
  groupName: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export const callSignUpdateSchema = callSignCreateSchema.partial();

export const vehicleCreateSchema = z.object({
  organizationId: optionalUuidSchema,
  vendorId: optionalUuidSchema,
  plateNumber: z.string().trim().min(1).max(40),
  vehicleType: z.string().trim().min(1).max(80),
  capacity: z.coerce.number().int().min(0).default(0),
  metadata: metadataSchema
});

export const vehicleUpdateSchema = vehicleCreateSchema.partial();

export const driverCreateSchema = z.object({
  organizationId: optionalUuidSchema,
  vendorId: optionalUuidSchema,
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(3).max(40),
  licenseType: z.string().trim().optional().nullable(),
  languages: z.array(z.string().trim()).default([]),
  metadata: metadataSchema
});

export const driverUpdateSchema = driverCreateSchema.partial();

export const timelineEventCreateSchema = z.object({
  projectId: uuidSchema,
  objectType: z.string().trim().min(1).max(80),
  objectId: optionalUuidSchema,
  eventType: z.string().trim().min(1).max(120),
  actorId: optionalUuidSchema,
  source: z.enum(["system", "operation_user", "driver_qr", "coordinator", "organizer", "import"]).default("system"),
  beforeData: z.record(z.unknown()).optional().nullable(),
  afterData: z.record(z.unknown()).optional().nullable(),
  reason: z.string().trim().optional().nullable(),
  metadata: metadataSchema
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type OperationDayCreateInput = z.infer<typeof operationDayCreateSchema>;
export type OperationDayUpdateInput = z.infer<typeof operationDayUpdateSchema>;
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;
export type MissionCreateInput = z.infer<typeof missionCreateSchema>;
export type MissionUpdateInput = z.infer<typeof missionUpdateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
export type CallSignCreateInput = z.infer<typeof callSignCreateSchema>;
export type CallSignUpdateInput = z.infer<typeof callSignUpdateSchema>;
export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;
export type DriverCreateInput = z.infer<typeof driverCreateSchema>;
export type DriverUpdateInput = z.infer<typeof driverUpdateSchema>;
export type TimelineEventCreateInput = z.infer<typeof timelineEventCreateSchema>;
