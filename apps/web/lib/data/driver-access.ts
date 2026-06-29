import type { Assignment, CallSign, Driver, Project, Vehicle } from "@tomp/types/domain";
import { demoAssignment, demoCallSign, demoDriver, demoProject, demoVehicle } from "@/lib/demo/demo-kernel";
import { hashDriverAccessToken } from "@/lib/driver-access/token";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export interface DriverAccessAssignment {
  token: string;
  project: Project;
  assignment: Assignment;
  callSign: CallSign;
  driver: Driver;
  vehicle: Vehicle;
  tokenValidated: boolean;
}

export async function getDriverAssignmentByToken(token: string): Promise<DriverAccessAssignment> {
  const { client } = getSupabaseWriteClient();
  if (client && token.startsWith("tomp_")) {
    const tokenHash = hashDriverAccessToken(token);
    const { data } = await client
      .from("driver_access_tokens")
      .select("project_id, assignment_id, driver_id, status, expires_at")
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .maybeSingle();

    if (data?.assignment_id && (!data.expires_at || new Date(String(data.expires_at)).getTime() > Date.now())) {
      await client
        .from("driver_access_tokens")
        .update({
          last_used_at: new Date().toISOString(),
          usage_count: 1
        })
        .eq("token_hash", tokenHash);

      return { ...fallbackDemoDriverAccess(token), tokenValidated: true };
    }
  }

  return fallbackDemoDriverAccess(token);
}

export async function getDriverActivationState(token: string) {
  return {
    token,
    confirmedName: false,
    confirmedPhone: false,
    confirmedVehicle: false,
    gpsConsent: false,
    vehiclePhotoCaptured: false,
    platePhotoCaptured: false,
    isFallback: true
  };
}

export function fallbackDemoDriverAccess(token: string): DriverAccessAssignment {
  return {
    token,
    project: demoProject,
    assignment: demoAssignment,
    callSign: demoCallSign,
    driver: demoDriver,
    vehicle: demoVehicle,
    tokenValidated: false
  };
}
