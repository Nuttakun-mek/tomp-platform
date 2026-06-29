"use server";

import { createAssignmentSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { mapAssignment } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createAssignmentTimelineEvent } from "@/lib/timeline";

export async function createAssignmentAction(input: unknown): Promise<ActionResult> {
  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Assignment validation failed.", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "Supabase is not configured for writes.");
  }

  const { data, error: insertError } = await client
    .from("assignments")
    .insert({
      project_id: parsed.data.projectId,
      mission_id: parsed.data.missionId,
      call_sign_id: parsed.data.callSignId,
      vehicle_id: parsed.data.vehicleId || null,
      driver_id: parsed.data.driverId || null,
      start_time: parsed.data.startTime || null,
      end_time: parsed.data.endTime || null,
      commitment_id: parsed.data.commitmentId || null,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(`Database insert failed: ${insertError.message}`);
  }

  const assignment = mapAssignment(data);
  const timelineResult = await createAssignmentTimelineEvent(assignment.projectId, assignment.id, data);

  return actionSuccess(
    { mode, assignment, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `Assignment was created, but timeline insert failed: ${timelineResult.error}`
  );
}
