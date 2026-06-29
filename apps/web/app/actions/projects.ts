"use server";

import { createProjectSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { mapProject } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createProjectTimelineEvent } from "@/lib/timeline";

export async function createProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Project validation failed.", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "Supabase is not configured for writes.");
  }

  const { data, error: insertError } = await client
    .from("projects")
    .insert({
      organization_id: parsed.data.organizationId,
      owner_profile_id: parsed.data.ownerProfileId || null,
      project_code: parsed.data.projectCode,
      project_name: parsed.data.projectName,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      timezone: parsed.data.timezone,
      visibility_level: parsed.data.visibilityLevel,
      service_level: parsed.data.serviceLevel,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(`Database insert failed: ${insertError.message}`);
  }

  const project = mapProject(data);
  const timelineResult = await createProjectTimelineEvent(project.id, project.id, data);

  return actionSuccess(
    { mode, project, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `Project was created, but timeline insert failed: ${timelineResult.error}`
  );
}
