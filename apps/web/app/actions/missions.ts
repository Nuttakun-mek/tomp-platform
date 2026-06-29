"use server";

import { createMissionSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { mapMission } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createMissionTimelineEvent } from "@/lib/timeline";

export async function createMissionAction(input: unknown): Promise<ActionResult> {
  const parsed = createMissionSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Mission validation failed.", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "Supabase is not configured for writes.");
  }

  const { data, error: insertError } = await client
    .from("missions")
    .insert({
      project_id: parsed.data.projectId,
      project_day_id: parsed.data.projectDayId,
      session_id: parsed.data.sessionId || null,
      mission_code: parsed.data.missionCode,
      mission_name: parsed.data.missionName,
      mission_type: parsed.data.missionType,
      priority: parsed.data.priority,
      planned_start_time: parsed.data.plannedStartTime || null,
      planned_end_time: parsed.data.plannedEndTime || null,
      pickup_venue_id: parsed.data.pickupVenueId || null,
      dropoff_venue_id: parsed.data.dropoffVenueId || null,
      instruction: parsed.data.instruction || null,
      service_commitment: parsed.data.serviceCommitment || null,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(`Database insert failed: ${insertError.message}`);
  }

  const mission = mapMission(data);
  const timelineResult = await createMissionTimelineEvent(mission.projectId, mission.id, data);

  return actionSuccess(
    { mode, mission, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `Mission was created, but timeline insert failed: ${timelineResult.error}`
  );
}
