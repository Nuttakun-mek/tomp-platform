"use server";

import { actionFailure, type ActionResult } from "@/lib/actions/action-result";
import { createTimelineEvent, type CreateTimelineEventInput } from "@/lib/timeline";

export async function appendTimelineEventAction(input: CreateTimelineEventInput): Promise<ActionResult> {
  if (!input.projectId || !input.eventType || !input.objectType) {
    return actionFailure("Timeline validation failed.", {
      eventType: ["projectId, objectType, and eventType are required."]
    });
  }

  return createTimelineEvent(input);
}
