import type { Driver, Vehicle } from "@tomp/types/domain";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapDriver, mapVehicle } from "./mappers";

export async function getDrivers(): Promise<Driver[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return demoKernel.drivers;

  const { data, error } = await supabase.from("drivers").select("*").order("full_name");
  if (error || !data) return demoKernel.drivers;
  return data.map(mapDriver);
}

export async function getVehicles(): Promise<Vehicle[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return demoKernel.vehicles;

  const { data, error } = await supabase.from("vehicles").select("*").order("plate_number");
  if (error || !data) return demoKernel.vehicles;
  return data.map(mapVehicle);
}
