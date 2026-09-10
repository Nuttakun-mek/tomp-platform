import { cache } from "react";
import type { Driver, Vehicle } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { demoOr } from "@/lib/data/demo-fallback";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { mapDriver, mapVehicle } from "./mappers";

// The central library: records kept between events, and the pool a project
// imports from. Project copies are excluded — counting a person once per
// project that hired them is not a useful number.
// cache(): one render often needs this list from several components; keep it to one query per request.
export const getDrivers = cache(async function getDrivers(): Promise<Driver[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return demoOr(demoKernel.drivers, []);

  try {
    const { data, error } = await withTimeout(
      supabase.from("drivers").select("*").is("project_id", null).is("deleted_at", null).order("full_name"),
      2200,
      "drivers"
    );
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
    const { data, error } = await withTimeout(
      supabase.from("vehicles").select("*").is("project_id", null).is("deleted_at", null).order("plate_number"),
      2200,
      "vehicles"
    );
    if (error || !data) return demoOr(demoKernel.vehicles, []);
    return data.map(mapVehicle);
  } catch {
    return demoOr(demoKernel.vehicles, []);
  }
});
// Project-scoped reads. A project sees only its own copies; the library — rows
// with no project_id — is the pool those copies are taken from. See 0035.

/** This project's own drivers. Empty for a project nobody has staffed yet. */
export const getProjectDrivers = cache(async function getProjectDrivers(projectId: string): Promise<Driver[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase || !projectId) return [];

  try {
    const { data, error } = await withTimeout(
      supabase.from("drivers").select("*").eq("project_id", projectId).is("deleted_at", null).order("full_name"),
      2200,
      "project-drivers"
    );
    if (error || !data) return [];
    return data.map(mapDriver);
  } catch {
    return [];
  }
});

/** This project's own vehicles. */
export const getProjectVehicles = cache(async function getProjectVehicles(projectId: string): Promise<Vehicle[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase || !projectId) return [];

  try {
    const { data, error } = await withTimeout(
      supabase.from("vehicles").select("*").eq("project_id", projectId).is("deleted_at", null).order("plate_number"),
      2200,
      "project-vehicles"
    );
    if (error || !data) return [];
    return data.map(mapVehicle);
  } catch {
    return [];
  }
});

/** The central library, minus anything this project has already taken. */
export const getLibraryDrivers = cache(async function getLibraryDrivers(projectId: string): Promise<Driver[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return [];

  try {
    const [{ data: library }, { data: taken }] = await Promise.all([
      supabase.from("drivers").select("*").is("project_id", null).is("deleted_at", null).order("full_name"),
      projectId
        ? supabase.from("drivers").select("source_driver_id").eq("project_id", projectId).is("deleted_at", null)
        : Promise.resolve({ data: [] as Array<{ source_driver_id: string | null }> })
    ]);
    if (!library) return [];
    const already = new Set((taken ?? []).map((row) => row.source_driver_id).filter(Boolean));
    return library.filter((row) => !already.has(row.id)).map(mapDriver);
  } catch {
    return [];
  }
});

/** The central vehicle library, minus anything this project has already taken. */
export const getLibraryVehicles = cache(async function getLibraryVehicles(projectId: string): Promise<Vehicle[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return [];

  try {
    const [{ data: library }, { data: taken }] = await Promise.all([
      supabase.from("vehicles").select("*").is("project_id", null).is("deleted_at", null).order("plate_number"),
      projectId
        ? supabase.from("vehicles").select("source_vehicle_id").eq("project_id", projectId).is("deleted_at", null)
        : Promise.resolve({ data: [] as Array<{ source_vehicle_id: string | null }> })
    ]);
    if (!library) return [];
    const already = new Set((taken ?? []).map((row) => row.source_vehicle_id).filter(Boolean));
    return library.filter((row) => !already.has(row.id)).map(mapVehicle);
  } catch {
    return [];
  }
});

/**
 * How many projects have taken each library record.
 *
 * Shown next to a library entry so an operator can see it is in use before
 * deleting it — the delete guard would refuse anyway, but only after the click.
 */
export const getResourceUsage = cache(async function getResourceUsage(): Promise<{
  drivers: Map<string, number>;
  vehicles: Map<string, number>;
}> {
  const { client: supabase } = await resolveReadClient();
  const empty = { drivers: new Map<string, number>(), vehicles: new Map<string, number>() };
  if (!supabase) return empty;

  const count = (rows: Array<{ source: string | null }> | null) => {
    const tally = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.source) continue;
      tally.set(row.source, (tally.get(row.source) ?? 0) + 1);
    }
    return tally;
  };

  try {
    const [driverCopies, vehicleCopies] = await Promise.all([
      supabase.from("drivers").select("source_driver_id").not("project_id", "is", null).is("deleted_at", null),
      supabase.from("vehicles").select("source_vehicle_id").not("project_id", "is", null).is("deleted_at", null)
    ]);
    return {
      drivers: count((driverCopies.data ?? []).map((row) => ({ source: row.source_driver_id }))),
      vehicles: count((vehicleCopies.data ?? []).map((row) => ({ source: row.source_vehicle_id })))
    };
  } catch {
    return empty;
  }
});
