"use server";

import { actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import type { CreateTimelineEventInput } from "@/lib/timeline";

export async function appendTimelineEventAction(input: CreateTimelineEventInput): Promise<ActionResult> {
  return actionSuccess({ mode: "placeholder", timelineEvent: input });
}
