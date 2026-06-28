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

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
