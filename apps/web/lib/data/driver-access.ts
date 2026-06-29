import type { Assignment, CallSign, Driver, Project, Vehicle } from "@tomp/types/domain";
import { demoAssignment, demoCallSign, demoDriver, demoProject, demoVehicle } from "@/lib/demo/demo-kernel";

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

