import { cache } from "react";
import type { CallSign } from "@tomp/types/domain";
import { type DataResult, runListQuery } from "@/lib/data/data-result";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { demoOr } from "@/lib/data/demo-fallback";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { mapCallSign } from "./mappers";

// cache(): one render often needs this list from several components; keep it to one query per request.
export const getCallSignsByProjectId = cache(async function getCallSignsByProjectId(
  projectId: string
): Promise<DataResult<CallSign[]>> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) {
    return { ok: true, data: demoOr(demoKernel.callSigns.filter((callSign) => callSign.projectId === projectId), []) };
  }

  return runListQuery({
    fallback: [],
    label: "call signs",
    query: () => supabase.from("call_signs").select("*").eq("project_id", projectId).order("call_sign"),
    map: (rows) => rows.map(mapCallSign)
  });
});