import "server-only";

import type { TimelineEvent, TimelineSource } from "@tomp/types/domain";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { mapTimelineEvent } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export const TIMELINE_EVENTS = {
  PROJECT_CREATED: "PROJECT_CREATED",
  MISSION_CREATED: "MISSION_CREATED",
  ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED",
  DRIVER_CREATED: "DRIVER_CREATED",
  VEHICLE_CREATED: "VEHICLE_CREATED",
  ASSIGNMENT_STATUS_CHANGED: "ASSIGNMENT_STATUS_CHANGED",
  PROJECT_PUBLISHED: "PROJECT_PUBLISHED",
  CHANGE_REQUEST_CREATED: "CHANGE_REQUEST_CREATED",
  CHANGE_REQUEST_APPROVED: "CHANGE_REQUEST_APPROVED",
  CHANGE_REQUEST_APPLIED: "CHANGE_REQUEST_APPLIED",
  CHANGE_REQUEST_REJECTED: "CHANGE_REQUEST_REJECTED",
  DRIVER_CHECKED_IN: "DRIVER_CHECKED_IN",
  VEHICLE_CHECKED_IN: "VEHICLE_CHECKED_IN",
  DRIVER_ISSUE_REPORTED: "DRIVER_ISSUE_REPORTED",
  DRIVER_ACCESS_TOKEN_CREATED: "DRIVER_ACCESS_TOKEN_CREATED",
  DRIVER_ACCESS_TOKEN_REVOKED: "DRIVER_ACCESS_TOKEN_REVOKED",
  DRIVER_ACCESS_TOKEN_USED: "DRIVER_ACCESS_TOKEN_USED",
  DIRECT_EDIT_BLOCKED: "DIRECT_EDIT_BLOCKED"
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

export async function createTimelineEvent(input: CreateTimelineEventInput): Promise<ActionResult<TimelineEvent>> {
  const { client, error } = getSupabaseWriteClient();

  if (!client) {
    return actionFailure(error || "Supabase write client is not configured.");
  }

  const { data, error: insertError } = await client
    .from("timeline_events")
    .insert({
      project_id: input.projectId,
      object_type: input.objectType,
      object_id: input.objectId || null,
      event_type: input.eventType,
      actor_id: input.actorId || null,
      source: input.source || "system",
      reason: input.reason || null,
      before_data: input.beforeData || null,
      after_data: input.afterData || null,
      metadata: input.metadata || {}
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(insertError.message);
  }

  return actionSuccess(mapTimelineEvent(data));
}

export function createProjectTimelineEvent(projectId: string, objectId: string, afterData: Record<string, unknown>) {
  return createTimelineEvent({
    projectId,
    objectType: "project",
    objectId,
    eventType: TIMELINE_EVENTS.PROJECT_CREATED,
    source: "operation_user",
    reason: "Project created from server action.",
    afterData
  });
}

export function createMissionTimelineEvent(projectId: string, objectId: string, afterData: Record<string, unknown>) {
  return createTimelineEvent({
    projectId,
    objectType: "mission",
    objectId,
    eventType: TIMELINE_EVENTS.MISSION_CREATED,
    source: "operation_user",
    reason: "Mission created from server action.",
    afterData
  });
}

export function createAssignmentTimelineEvent(projectId: string, objectId: string, afterData: Record<string, unknown>) {
  return createTimelineEvent({
    projectId,
    objectType: "assignment",
    objectId,
    eventType: TIMELINE_EVENTS.ASSIGNMENT_CREATED,
    source: "operation_user",
    reason: "Assignment created from server action.",
    afterData
  });
}
