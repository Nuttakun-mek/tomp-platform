"use server";

import { createMissionSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";

export async function createMissionAction(input: unknown): Promise<ActionResult> {
  const parsed = createMissionSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Mission validation failed.", parsed.error.flatten().fieldErrors);
  }

  return actionSuccess({ mode: "placeholder", mission: parsed.data });
}
