"use server";

import { createAssignmentSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";

export async function createAssignmentAction(input: unknown): Promise<ActionResult> {
  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Assignment validation failed.", parsed.error.flatten().fieldErrors);
  }

  return actionSuccess({ mode: "placeholder", assignment: parsed.data });
}
