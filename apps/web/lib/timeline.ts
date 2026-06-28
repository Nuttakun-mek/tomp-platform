import type { TimelineSource } from "@tomp/types/domain";

export const TIMELINE_EVENTS = {
  PROJECT_CREATED: "PROJECT_CREATED",
  MISSION_CREATED: "MISSION_CREATED",
  ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED",
  DRIVER_CREATED: "DRIVER_CREATED",
  VEHICLE_CREATED: "VEHICLE_CREATED",
  ASSIGNMENT_STATUS_CHANGED: "ASSIGNMENT_STATUS_CHANGED"
} as const;

export interface CreateTimelineEventInput {
  projectId: string;
  objectType: string;
  objectId?: string | null;
  eventType: string;
  actorId?: string | null;
  source?: TimelineSource;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createTimelineEvent(input: CreateTimelineEventInput): Promise<CreateTimelineEventInput> {
  // Sprint 1 placeholder only. Database-backed timeline writes start after access policies are defined.
  return {
    source: "system",
    metadata: {},
    ...input
  };
}
