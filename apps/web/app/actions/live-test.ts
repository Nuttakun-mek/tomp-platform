"use server";

import type { ActionResult } from "@/lib/actions/action-result";
import { createProductionPilotSmokeScenarioAction } from "./pilot-smoke-test";

export async function createLiveGpsPilotScenarioAction(): Promise<ActionResult> {
  return createProductionPilotSmokeScenarioAction();
}
