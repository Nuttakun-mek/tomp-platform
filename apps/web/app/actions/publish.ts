"use server";

import { publishProjectSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { requirePermission } from "@/lib/auth/rbac";
import { createPublishLock } from "@/lib/domain/publish-locking";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

export async function publishProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = publishProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Publish validation failed.", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "Supabase is not configured for writes.");
  }
  const permission = await requirePermission(parsed.data.projectId, "project.publish");
  if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "Missing permission: project.publish");

  const { data, error: insertError } = await client
    .from("publish_snapshots")
    .insert({
      project_id: parsed.data.projectId,
      object_type: "project",
      object_id: parsed.data.projectId,
      status: "published",
      reason: parsed.data.reason,
      snapshot_data: parsed.data.snapshotData,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(`Publish snapshot failed: ${insertError.message}`);
  }

  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "project",
    objectId: parsed.data.projectId,
    eventType: TIMELINE_EVENTS.PROJECT_PUBLISHED,
    source: "operation_user",
    reason: parsed.data.reason,
    afterData: data
  });
  const lockResult = await createPublishLock(parsed.data.projectId, data.id, parsed.data.reason);

  return actionSuccess(
    { mode, publishSnapshot: data, publishLock: lockResult, timelineEvent: timelineResult.data },
    !timelineResult.success
      ? `Publish snapshot created, but timeline insert failed: ${timelineResult.error}`
      : lockResult.success
        ? undefined
        : `Publish snapshot created, but publish lock failed: ${lockResult.error}`
  );
}
