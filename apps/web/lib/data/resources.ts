import { cache } from "react";
import type { Driver, Vehicle } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { demoOr } from "@/lib/data/demo-fallback";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { mapDriver, mapVehicle } from "./mappers";

// cache(): one render often needs this list from several components; keep it to one query per request.
export const getDrivers = cache(async function getDrivers(): Promise<Driver[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return demoOr(demoKernel.drivers, []);

  try {
    const { data, error } = await withTimeout(supabase.from("drivers").select("*").order("full_name"), 2200, "drivers");
    if (error || !data) return demoOr(demoKernel.drivers, []);
    return data.map(mapDriver);
  } catch {
    return demoOr(demoKernel.drivers, []);
  }
});
// cache(): one render often needs this list from several components; keep it to one query per request.
export const getVehicles = cache(async function getVehicles(): Promise<Vehicle[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return demoOr(demoKernel.vehicles, []);

  try {
    const { data, error } = await withTimeout(supabase.from("vehicles").select("*").order("plate_number"), 2200, "vehicles");
    if (error || !data) return demoOr(demoKernel.vehicles, []);
    return data.map(mapVehicle);
  } catch {
    return demoOr(demoKernel.vehicles, []);
  }
});