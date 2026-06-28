"use server";

import { createProjectSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";

export async function createProjectAction(input: unknown): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Project validation failed.", parsed.error.flatten().fieldErrors);
  }

  return actionSuccess({ mode: "placeholder", project: parsed.data });
}
