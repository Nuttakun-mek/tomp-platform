import type { Driver, Vehicle } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { mapDriver, mapVehicle } from "./mappers";

export async function getDrivers(): Promise<Driver[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return demoKernel.drivers;

  try {
    const { data, error } = await withTimeout(supabase.from("drivers").select("*").order("full_name"), 2200, "drivers");
    if (error || !data) return demoKernel.drivers;
    return data.map(mapDriver);
  } catch {
    return demoKernel.drivers;
  }
}

export async function getVehicles(): Promise<Vehicle[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return demoKernel.vehicles;

  try {
    const { data, error } = await withTimeout(supabase.from("vehicles").select("*").order("plate_number"), 2200, "vehicles");
    if (error || !data) return demoKernel.vehicles;
    return data.map(mapVehicle);
  } catch {
    return demoKernel.vehicles;
  }
}
