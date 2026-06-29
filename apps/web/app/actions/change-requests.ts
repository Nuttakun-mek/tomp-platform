"use server";

import {
  applyChangeRequestSchema,
  approveChangeRequestSchema,
  createChangeRequestSchema,
  rejectChangeRequestSchema
} from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

async function appendChangeTimeline(projectId: string, objectId: string, eventType: string, reason?: string | null, afterData?: Record<string, unknown> | null) {
  return createTimelineEvent({
    projectId,
    objectType: "change_request",
    objectId,
    eventType,
    source: "operation_user",
    reason: reason || "Change request status updated.",
    afterData: afterData || {}
  });
}

export async function createChangeRequestAction(input: unknown): Promise<ActionResult> {
  const parsed = createChangeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Change request validation failed.", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: insertError } = await client
    .from("change_requests")
    .insert({
      project_id: parsed.data.projectId,
      object_type: parsed.data.objectType,
      object_id: parsed.data.objectId || null,
      severity: parsed.data.severity,
      reason: parsed.data.reason,
      impact_summary: parsed.data.impactSummary || null,
      before_data: parsed.data.beforeData || null,
      after_data: parsed.data.afterData || null,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) return actionFailure(`Change request insert failed: ${insertError.message}`);

  const timelineResult = await appendChangeTimeline(parsed.data.projectId, data.id, TIMELINE_EVENTS.CHANGE_REQUEST_CREATED, parsed.data.reason, data);
  return actionSuccess({ mode, changeRequest: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}

export async function approveChangeRequestAction(input: unknown): Promise<ActionResult> {
  const parsed = approveChangeRequestSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Approve change request validation failed.", parsed.error.flatten().fieldErrors);
  return updateChangeStatus(parsed.data.projectId, parsed.data.changeRequestId, "approved", TIMELINE_EVENTS.CHANGE_REQUEST_APPROVED, parsed.data.reason);
}

export async function applyChangeRequestAction(input: unknown): Promise<ActionResult> {
  const parsed = applyChangeRequestSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Apply change request validation failed.", parsed.error.flatten().fieldErrors);
  return updateChangeStatus(parsed.data.projectId, parsed.data.changeRequestId, "applied", TIMELINE_EVENTS.CHANGE_REQUEST_APPLIED, parsed.data.reason, parsed.data.afterData);
}

export async function rejectChangeRequestAction(input: unknown): Promise<ActionResult> {
  const parsed = rejectChangeRequestSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Reject change request validation failed.", parsed.error.flatten().fieldErrors);
  return updateChangeStatus(parsed.data.projectId, parsed.data.changeRequestId, "rejected", TIMELINE_EVENTS.CHANGE_REQUEST_REJECTED, parsed.data.reason);
}

async function updateChangeStatus(projectId: string, changeRequestId: string, status: string, eventType: string, reason?: string | null, afterData?: Record<string, unknown>): Promise<ActionResult> {
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const { data, error: updateError } = await client
    .from("change_requests")
    .update({ status, after_data: afterData || undefined })
    .eq("id", changeRequestId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (updateError) return actionFailure(`Change request update failed: ${updateError.message}`);

  const timelineResult = await appendChangeTimeline(projectId, changeRequestId, eventType, reason, data);
  return actionSuccess({ mode, changeRequest: data, timelineEvent: timelineResult.data }, timelineResult.success ? undefined : timelineResult.error);
}
